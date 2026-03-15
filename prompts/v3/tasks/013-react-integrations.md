# Task 013 — React Integrations Page

## Goal

Implement the Integrations page with three sections: Memories (CRUD + entry
viewer), Calendars (CRUD), and WhatsApp (connection status, QR code display,
phone number setting, and groups management). All sections use optimistic
updates and toast feedback.

---

## Prerequisites

- Task 010 complete: all UI primitives, API client layer (`integrations/` modules
  in `src/api/`), React Query, and toast helpers are available.
- Task 008 complete: all Rails integration API endpoints are live.
- Task 007 complete (WhatsApp service fully implemented): status, connect,
  disconnect, and groups endpoints respond correctly.

---

## Implementation steps

### 1. IntegrationsPage layout

**`src/pages/IntegrationsPage.tsx`**

The page uses a tabbed layout. Each tab renders one section component.

```tsx
import { useState } from "react";
import { MemoriesSection } from "../components/integrations/MemoriesSection";
import { CalendarsSection } from "../components/integrations/CalendarsSection";
import { WhatsAppSection } from "../components/integrations/WhatsAppSection";

type Tab = "memories" | "calendars" | "whatsapp";

const TABS: { id: Tab; label: string }[] = [
  { id: "memories",  label: "Memories" },
  { id: "calendars", label: "Calendars" },
  { id: "whatsapp",  label: "WhatsApp" },
];

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("memories");

  return (
    <div>
      <h1>Integrations</h1>

      <div role="tablist" className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? "tab active" : "tab"}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "memories"  && <MemoriesSection />}
        {activeTab === "calendars" && <CalendarsSection />}
        {activeTab === "whatsapp"  && <WhatsAppSection />}
      </div>
    </div>
  );
}
```

---

### 2. MemoriesSection

**`src/components/integrations/MemoriesSection.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { memoriesApi } from "../../api/integrations/memories";
import { Table, Th, Td, Tr } from "../ui/Table";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { showSuccess, showError } from "../../lib/toast";

interface CreateMemoryForm {
  label: string;
  max_memories: number;
  ttl_hours: number;
  max_value_size: number;
}

// Label validation: alphanumeric, hyphens, underscores only.
const LABEL_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function MemoriesSection() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewingLabel, setViewingLabel] = useState<string | null>(null);

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: memoriesApi.list,
  });

  // Entry count per memory — fetched lazily when a memory row is hovered or expanded.
  // For the table view, show entry count from a per-label query keyed by label.
  // Implementation: render entry count via a small inline <MemoryEntryCount label={label} /> component.

  const createMutation = useMutation({
    mutationFn: memoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      showSuccess("Memory config created");
      setCreateModalOpen(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: memoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      showSuccess("Memory config deleted");
    },
    onError: (err: Error) => showError(err.message),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateMemoryForm>({
    defaultValues: { max_memories: 100, ttl_hours: 24, max_value_size: 1000 },
  });

  function onCreateSubmit(data: CreateMemoryForm) {
    createMutation.mutate(data);
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2>Memories</h2>
        <Button onClick={() => { reset(); setCreateModalOpen(true); }}>New Memory</Button>
      </div>

      {!memories?.length ? (
        <EmptyState
          message="No memory configs yet"
          cta={{ label: "Create Memory", onClick: () => setCreateModalOpen(true) }}
        />
      ) : (
        <Table>
          <thead>
            <Tr>
              <Th>Label</Th>
              <Th>Max Memories</Th>
              <Th>TTL (hours)</Th>
              <Th>Max Value Size</Th>
              <Th>Entries</Th>
              <Th>Actions</Th>
            </Tr>
          </thead>
          <tbody>
            {memories.map((memory) => (
              <Tr key={memory.id}>
                <Td>{memory.label}</Td>
                <Td>{memory.max_memories}</Td>
                <Td>{memory.ttl_hours}</Td>
                <Td>{memory.max_value_size}</Td>
                <Td><MemoryEntryCount label={memory.label} /></Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => setViewingLabel(memory.label)}>
                    View Entries
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteMutation.mutate(memory.label)}
                  >
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Create modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Memory Config">
        <form onSubmit={handleSubmit(onCreateSubmit)}>
          <Input
            label="Label"
            placeholder="my-memory"
            error={errors.label?.message}
            {...register("label", {
              required: "Label is required",
              pattern: { value: LABEL_PATTERN, message: "Only letters, numbers, hyphens, underscores" },
            })}
          />
          <Input
            label="Max Memories"
            type="number"
            error={errors.max_memories?.message}
            {...register("max_memories", { valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
          />
          <Input
            label="TTL (hours)"
            type="number"
            error={errors.ttl_hours?.message}
            {...register("ttl_hours", { valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
          />
          <Input
            label="Max Value Size (chars)"
            type="number"
            error={errors.max_value_size?.message}
            {...register("max_value_size", { valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
          />
          <Button type="submit" loading={createMutation.isPending}>Create</Button>
        </form>
      </Modal>

      {/* Entries viewer modal */}
      <Modal
        open={!!viewingLabel}
        onClose={() => setViewingLabel(null)}
        title={`Entries: ${viewingLabel}`}
      >
        {viewingLabel && <MemoryEntriesViewer label={viewingLabel} />}
      </Modal>
    </div>
  );
}
```

#### `MemoryEntryCount` (inline component in same file)

```tsx
function MemoryEntryCount({ label }: { label: string }) {
  const { data } = useQuery({
    queryKey: ["memory_entries", label],
    queryFn: () => memoriesApi.entries(label, 500),
    staleTime: 60_000,
  });
  if (data === undefined) return <span>—</span>;
  return <span>{data.length}</span>;
}
```

#### `MemoryEntriesViewer` (inline component in same file)

```tsx
function MemoryEntriesViewer({ label }: { label: string }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["memory_entries", label],
    queryFn: () => memoriesApi.entries(label, 20),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!entries?.length) return <p>No entries yet.</p>;

  return (
    <Table>
      <thead>
        <Tr><Th>Timestamp</Th><Th>Value</Th></Tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <Tr key={entry.id}>
            <Td>{new Date(entry.created_at).toLocaleString()}</Td>
            <Td>{entry.value}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
```

---

### 3. CalendarsSection

**`src/components/integrations/CalendarsSection.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { calendarsApi } from "../../api/integrations/calendars";
import { Table, Th, Td, Tr } from "../ui/Table";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { showSuccess, showError } from "../../lib/toast";

interface CreateCalendarForm {
  label: string;
  calendar_id: string;
  credentials_file: string;
}

export function CalendarsSection() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: calendars, isLoading } = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: calendarsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      showSuccess("Calendar added");
      setModalOpen(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: calendarsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      showSuccess("Calendar removed");
    },
    onError: (err: Error) => showError(err.message),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateCalendarForm>();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2>Calendars</h2>
        <Button onClick={() => { reset(); setModalOpen(true); }}>Add Calendar</Button>
      </div>

      {!calendars?.length ? (
        <EmptyState
          message="No calendars configured"
          cta={{ label: "Add Calendar", onClick: () => setModalOpen(true) }}
        />
      ) : (
        <Table>
          <thead>
            <Tr>
              <Th>Label</Th>
              <Th>Calendar ID</Th>
              <Th>Credentials File</Th>
              <Th>Actions</Th>
            </Tr>
          </thead>
          <tbody>
            {calendars.map((cal) => (
              <Tr key={cal.id}>
                <Td>{cal.label}</Td>
                <Td>{cal.calendar_id}</Td>
                <Td>{cal.credentials_file}</Td>
                <Td>
                  <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(cal.id)}>
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Calendar">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
          <Input
            label="Label"
            placeholder="My Work Calendar"
            error={errors.label?.message}
            {...register("label", { required: "Label is required" })}
          />
          <Input
            label="Calendar ID"
            placeholder="user@example.com"
            error={errors.calendar_id?.message}
            {...register("calendar_id", { required: "Calendar ID is required" })}
          />
          <Input
            label="Credentials File Path"
            placeholder="/secrets/google_credentials.json"
            error={errors.credentials_file?.message}
            {...register("credentials_file", { required: "Credentials file path is required" })}
          />
          <Button type="submit" loading={createMutation.isPending}>Add</Button>
        </form>
      </Modal>
    </div>
  );
}
```

---

### 4. WhatsAppSection

**`src/components/integrations/WhatsAppSection.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappApi } from "../../api/integrations/whatsapp";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { Input } from "../ui/Input";
import { Table, Th, Td, Tr } from "../ui/Table";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { showSuccess, showError } from "../../lib/toast";
import type { WhatsAppGroup } from "../../api/types";

function statusBadgeVariant(status: string) {
  if (status === "connected") return "success" as const;
  if (status === "error") return "error" as const;
  if (status === "pending_qr") return "warning" as const;
  return "neutral" as const;
}

export function WhatsAppSection() {
  const queryClient = useQueryClient();

  // Poll status every 5s while not connected (to catch QR scan and connection events).
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["whatsapp_status"],
    queryFn: whatsappApi.status,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "connected" ? false : 5_000;
    },
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["whatsapp_groups"],
    queryFn: whatsappApi.groups,
  });

  const connectMutation = useMutation({
    mutationFn: whatsappApi.connect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
      showSuccess("Connect initiated");
    },
    onError: (err: Error) => showError(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: whatsappApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
      showSuccess("Disconnected");
    },
    onError: (err: Error) => showError(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: whatsappApi.syncGroups,
    onSuccess: () => {
      // The job is async; invalidate after a short delay to pick up new groups.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["whatsapp_groups"] }), 2_000);
      showSuccess("Sync started");
    },
    onError: (err: Error) => showError(err.message),
  });

  if (statusLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2>WhatsApp</h2>

      {/* Connection status card */}
      <ConnectionStatusCard
        statusData={statusData}
        onConnect={() => connectMutation.mutate()}
        onDisconnect={() => disconnectMutation.mutate()}
        isConnecting={connectMutation.isPending}
        isDisconnecting={disconnectMutation.isPending}
      />

      {/* Phone number setting */}
      <PhoneNumberCard phoneNumber={statusData?.phone_number ?? ""} />

      {/* Groups table */}
      <Card style={{ marginTop: 24 }}>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>WhatsApp Groups</span>
            <Button size="sm" variant="secondary" onClick={() => syncMutation.mutate()} loading={syncMutation.isPending}>
              Sync Groups
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {groupsLoading ? (
            <LoadingSpinner />
          ) : !groups?.length ? (
            <p>No groups synced yet. Click "Sync Groups" to fetch them from WhatsApp.</p>
          ) : (
            <GroupsTable groups={groups} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

#### `ConnectionStatusCard` (inline component in same file)

```tsx
interface ConnectionStatusCardProps {
  statusData: { status: string; qr_svg: string | null } | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
}

function ConnectionStatusCard({
  statusData, onConnect, onDisconnect, isConnecting, isDisconnecting,
}: ConnectionStatusCardProps) {
  const status = statusData?.status ?? "disconnected";

  return (
    <Card>
      <CardHeader>Connection</CardHeader>
      <CardBody>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
          {status !== "connected" && (
            <Button size="sm" onClick={onConnect} loading={isConnecting}>
              Connect
            </Button>
          )}
          {status === "connected" && (
            <Button size="sm" variant="danger" onClick={onDisconnect} loading={isDisconnecting}>
              Disconnect
            </Button>
          )}
        </div>

        {/* QR code: only shown when status is pending_qr */}
        {status === "pending_qr" && statusData?.qr_svg && (
          <div
            aria-label="WhatsApp QR code"
            dangerouslySetInnerHTML={{ __html: statusData.qr_svg }}
            style={{ maxWidth: 300 }}
          />
        )}

        {status === "pending_qr" && !statusData?.qr_svg && (
          <p>Generating QR code…</p>
        )}
      </CardBody>
    </Card>
  );
}
```

Note: `dangerouslySetInnerHTML` is acceptable here because the SVG comes from
the internal WhatsApp service, not from untrusted user input. Add a code comment
noting this.

#### `PhoneNumberCard` (inline component in same file)

```tsx
function PhoneNumberCard({ phoneNumber }: { phoneNumber: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phoneNumber);

  const updateMutation = useMutation({
    mutationFn: (phone: string) => whatsappApi.updateSettings({ phone_number: phone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
      showSuccess("Phone number saved");
      setEditing(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  return (
    <Card style={{ marginTop: 16 }}>
      <CardHeader>Phone Number</CardHeader>
      <CardBody>
        {editing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              label="Phone Number"
              type="tel"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button size="sm" onClick={() => updateMutation.mutate(value)} loading={updateMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>{phoneNumber || "Not set"}</span>
            <Button size="sm" variant="secondary" onClick={() => { setValue(phoneNumber); setEditing(true); }}>
              Edit
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
```

#### `GroupsTable` (inline component in same file)

```tsx
function GroupsTable({ groups }: { groups: WhatsAppGroup[] }) {
  const queryClient = useQueryClient();

  const updateLabelMutation = useMutation({
    mutationFn: ({ jid, label }: { jid: string; label: string }) =>
      whatsappApi.updateGroupLabel(jid, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_groups"] });
      showSuccess("Group label updated");
    },
    onError: (err: Error) => showError(err.message),
  });

  return (
    <Table>
      <thead>
        <Tr>
          <Th>JID</Th>
          <Th>Name</Th>
          <Th>Label</Th>
        </Tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <GroupRow
            key={group.jid}
            group={group}
            onSaveLabel={(label) => updateLabelMutation.mutate({ jid: group.jid, label })}
            isSaving={updateLabelMutation.isPending}
          />
        ))}
      </tbody>
    </Table>
  );
}

// Each row has an inline editable label field.
function GroupRow({
  group, onSaveLabel, isSaving,
}: {
  group: WhatsAppGroup;
  onSaveLabel: (label: string) => void;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState(group.label);

  return (
    <Tr>
      <Td><code>{group.jid}</code></Td>
      <Td>{group.name}</Td>
      <Td>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label={`Label for group ${group.name}`}
          />
          <Button size="sm" onClick={() => onSaveLabel(label)} loading={isSaving}>
            Save
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
```

---

### 5. Component specs

All specs in `src/components/integrations/__tests__/` and
`src/pages/__tests__/IntegrationsPage.test.tsx`.

Mock API modules:

```ts
vi.mock("../../api/integrations/memories", () => ({ memoriesApi: { ... } }));
vi.mock("../../api/integrations/calendars", () => ({ calendarsApi: { ... } }));
vi.mock("../../api/integrations/whatsapp",  () => ({ whatsappApi: { ... } }));
```

#### `IntegrationsPage.test.tsx` — key cases

- Renders three tab buttons: Memories, Calendars, WhatsApp
- Clicking "Calendars" tab renders `CalendarsSection` content
- Clicking "WhatsApp" tab renders `WhatsAppSection` content
- Default tab is Memories

#### `MemoriesSection.test.tsx` — key cases

- Renders memory rows with label, max_memories, ttl_hours, max_value_size
- "New Memory" button opens create modal
- Create form shows validation error when label is empty
- Create form shows validation error when label contains invalid characters (e.g. "my label!")
- Submitting a valid form calls `memoriesApi.create` with correct data
- Delete button calls `memoriesApi.delete` with the memory label
- "View Entries" button opens the entries modal and calls `memoriesApi.entries`

#### `CalendarsSection.test.tsx` — key cases

- Renders calendar rows with label, calendar_id, credentials_file
- "Add Calendar" button opens modal
- Submitting valid form calls `calendarsApi.create`
- Delete button calls `calendarsApi.delete` with the calendar id

#### `WhatsAppSection.test.tsx` — key cases

- Renders status Badge with correct variant for each status value
- When status is `"pending_qr"` and `qr_svg` is non-null, the SVG is rendered in the DOM
- When status is `"pending_qr"` and `qr_svg` is null, "Generating QR code…" text is shown
- When status is `"connected"`, "Disconnect" button is shown; "Connect" button is absent
- When status is `"disconnected"`, "Connect" button is shown; "Disconnect" button is absent
- "Connect" button calls `whatsappApi.connect`
- "Disconnect" button calls `whatsappApi.disconnect`
- "Sync Groups" button calls `whatsappApi.syncGroups` and shows "Sync started" toast
- Phone number "Edit" button switches to an editable input; "Save" calls `whatsappApi.updateSettings`
- Group label "Save" button calls `whatsappApi.updateGroupLabel` with correct jid and label

---

## File / class list

| Path | Description |
|---|---|
| `src/pages/IntegrationsPage.tsx` | Tabbed layout rendering Memories/Calendars/WhatsApp sections |
| `src/components/integrations/MemoriesSection.tsx` | Memory CRUD + entry viewer |
| `src/components/integrations/CalendarsSection.tsx` | Calendar CRUD |
| `src/components/integrations/WhatsAppSection.tsx` | Status card, QR display, phone setting, groups table |
| `src/pages/__tests__/IntegrationsPage.test.tsx` | Tab navigation specs |
| `src/components/integrations/__tests__/MemoriesSection.test.tsx` | Memories CRUD specs |
| `src/components/integrations/__tests__/CalendarsSection.test.tsx` | Calendars CRUD specs |
| `src/components/integrations/__tests__/WhatsAppSection.test.tsx` | WhatsApp status/QR/groups specs |

---

## Acceptance criteria

- [ ] Navigating to `/integrations` shows the tabbed layout with all three tabs
- [ ] Clicking each tab renders the correct section without a page reload
- [ ] "New Memory" opens a modal; submitting with valid data creates a memory and shows success toast
- [ ] Submitting with an invalid label (e.g. with spaces) shows a validation error inline
- [ ] Memory table shows an entry count per row
- [ ] "View Entries" opens a modal listing the most recent entries for that memory
- [ ] "Delete" on a memory removes it and shows success toast
- [ ] "Add Calendar" opens a modal; submitting with valid data creates a calendar
- [ ] "Delete" on a calendar removes it and shows success toast
- [ ] WhatsApp status card shows the correct badge for each status value
- [ ] When status is `pending_qr`, the QR SVG renders inside the connection card
- [ ] "Connect" button is visible when disconnected; "Disconnect" visible when connected
- [ ] Phone number can be edited inline and saved with a success toast
- [ ] Groups table lists all synced groups with editable label fields
- [ ] "Sync Groups" button triggers sync and shows "Sync started" toast
- [ ] Saving a group label calls the update API and shows success toast
- [ ] `npx vitest run` passes all specs in this task with zero failures
