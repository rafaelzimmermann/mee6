# Task 012 — React Triggers and Run History

## Goal

Implement the Triggers page (table + modal form for all three trigger types,
enable/disable toggle, run now), and the Run History page (sortable table with
status badges, auto-refresh, status filter). Includes `useTriggers` and
`useRunRecords` hooks.

---

## Prerequisites

- Task 010 complete: all UI primitives, API client layer, React Query, and toast
  helpers are available.
- Task 011 complete: `usePipelines` hook and the `PipelinesPage` conventions are
  established and can be referenced for consistency.
- Task 006 or later complete: Rails `GET /api/v1/triggers`, `POST`, `PUT`,
  `DELETE`, `PATCH /enabled`, and `POST /:id/run_now` endpoints exist.

---

## Implementation steps

### 1. `useTriggers` hook

**`src/hooks/useTriggers.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { triggersApi } from "../api/triggers";
import { showSuccess, showError } from "../lib/toast";
import type { Trigger } from "../api/types";

export function useTriggers() {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["triggers"],
    queryFn: triggersApi.list,
  });

  const create = useMutation({
    mutationFn: triggersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      showSuccess("Trigger created");
    },
    onError: (err: Error) => showError(err.message),
  });

  const remove = useMutation({
    mutationFn: triggersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      showSuccess("Trigger deleted");
    },
    onError: (err: Error) => showError(err.message),
  });

  // Optimistic toggle: flips enabled locally before the server responds.
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      triggersApi.toggle(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["triggers"] });
      const previous = queryClient.getQueryData<Trigger[]>(["triggers"]);
      queryClient.setQueryData<Trigger[]>(["triggers"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, enabled } : t)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["triggers"], context.previous);
      }
      showError("Failed to update trigger");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
  });

  const runNow = useMutation({
    mutationFn: triggersApi.runNow,
    onSuccess: () => showSuccess("Trigger run queued"),
    onError: (err: Error) => showError(err.message),
  });

  return { list, create, remove, toggle, runNow };
}
```

---

### 2. `useRunRecords` hook

**`src/hooks/useRunRecords.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { runRecordsApi } from "../api/runRecords";

interface UseRunRecordsOptions {
  status?: string;
  limit?: number;
  refetchInterval?: number;
}

export function useRunRecords(options: UseRunRecordsOptions = {}) {
  const { status, limit, refetchInterval = 0 } = options;

  return useQuery({
    queryKey: ["run_records", { status, limit }],
    queryFn: () => runRecordsApi.list({ status, limit }),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
}
```

---

### 3. CronPreview component

**`src/components/triggers/CronPreview.tsx`**

Displays a human-readable description of a cron expression below the input field.
Use the `cronstrue` npm package.

```bash
npm install cronstrue
```

```tsx
import cronstrue from "cronstrue";

interface CronPreviewProps {
  expression: string;
}

export function CronPreview({ expression }: CronPreviewProps) {
  if (!expression.trim()) return null;

  let description: string;
  try {
    description = cronstrue.toString(expression);
  } catch {
    description = "Invalid cron expression";
  }

  const isValid = description !== "Invalid cron expression";

  return (
    <p style={{ color: isValid ? "var(--color-text-muted)" : "var(--color-error)", fontSize: "0.875rem" }}>
      {description}
    </p>
  );
}
```

---

### 4. TriggerForm component

**`src/components/triggers/TriggerForm.tsx`**

Rendered inside a `Modal`. The trigger type is selected first; the remaining
fields change accordingly. Uses `react-hook-form` for field management and
validation.

```tsx
import { useForm, Controller } from "react-hook-form";
import { usePipelines } from "../../hooks/usePipelines";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { CronPreview } from "./CronPreview";
import type { Trigger } from "../../api/types";

type TriggerType = "cron" | "whatsapp" | "wa_group";

interface TriggerFormValues {
  pipeline_id: string;
  trigger_type: TriggerType;
  cron_expr: string;
  phone: string;
  group_jid: string;
  enabled: boolean;
}

interface TriggerFormProps {
  onSubmit: (data: Partial<Trigger>) => void;
  isSubmitting: boolean;
}

export function TriggerForm({ onSubmit, isSubmitting }: TriggerFormProps) {
  const { list: pipelineList } = usePipelines();

  const { control, watch, handleSubmit, formState: { errors } } = useForm<TriggerFormValues>({
    defaultValues: {
      pipeline_id: "",
      trigger_type: "cron",
      cron_expr: "",
      phone: "",
      group_jid: "",
      enabled: true,
    },
  });

  const triggerType = watch("trigger_type");
  const cronExpr = watch("cron_expr");

  const pipelineOptions = (pipelineList.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  function handleFormSubmit(values: TriggerFormValues) {
    const config: Record<string, string> = {};
    if (values.trigger_type === "whatsapp") config.phone = values.phone;
    if (values.trigger_type === "wa_group") config.group_jid = values.group_jid;

    onSubmit({
      pipeline_id: values.pipeline_id,
      trigger_type: values.trigger_type,
      cron_expr: values.trigger_type === "cron" ? values.cron_expr : undefined,
      config,
      enabled: values.enabled,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      {/* Trigger type selector — rendered first; determines which fields follow */}
      <Controller
        name="trigger_type"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Select
            label="Trigger Type"
            options={[
              { value: "cron", label: "Cron Schedule" },
              { value: "whatsapp", label: "WhatsApp DM" },
              { value: "wa_group", label: "WhatsApp Group" },
            ]}
            error={errors.trigger_type ? "Required" : undefined}
            {...field}
          />
        )}
      />

      {/* Pipeline selector — shared across all trigger types */}
      <Controller
        name="pipeline_id"
        control={control}
        rules={{ required: "Pipeline is required" }}
        render={({ field }) => (
          <Select
            label="Pipeline"
            options={[{ value: "", label: "Select pipeline…" }, ...pipelineOptions]}
            error={errors.pipeline_id?.message}
            {...field}
          />
        )}
      />

      {/* Cron-specific fields */}
      {triggerType === "cron" && (
        <>
          <Controller
            name="cron_expr"
            control={control}
            rules={{ required: "Cron expression is required" }}
            render={({ field }) => (
              <Input
                label="Cron Expression"
                placeholder="0 8 * * *"
                error={errors.cron_expr?.message}
                {...field}
              />
            )}
          />
          <CronPreview expression={cronExpr} />
        </>
      )}

      {/* WhatsApp DM-specific fields */}
      {triggerType === "whatsapp" && (
        <Controller
          name="phone"
          control={control}
          rules={{ required: "Phone number is required" }}
          render={({ field }) => (
            <Input
              label="Phone Number"
              type="tel"
              placeholder="+15550001234"
              error={errors.phone?.message}
              {...field}
            />
          )}
        />
      )}

      {/* WhatsApp Group-specific fields */}
      {triggerType === "wa_group" && (
        <Controller
          name="group_jid"
          control={control}
          rules={{ required: "Group is required" }}
          render={({ field }) => (
            <GroupJidSelect error={errors.group_jid?.message} fieldProps={field} />
          )}
        />
      )}

      {/* Enabled toggle — shared */}
      <Controller
        name="enabled"
        control={control}
        render={({ field }) => (
          <label>
            <input
              type="checkbox"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
            {" "}Enabled
          </label>
        )}
      />

      <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
        Create Trigger
      </Button>
    </form>
  );
}
```

`GroupJidSelect` is a small inline component inside `TriggerForm.tsx` that
fetches groups from `whatsappApi.groups()` via React Query and renders them in
a `<Select>`.

---

### 5. TriggersPage

**`src/pages/TriggersPage.tsx`**

```tsx
import { useState } from "react";
import { useTriggers } from "../hooks/useTriggers";
import { Table, Th, Td, Tr } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { TriggerForm } from "../components/triggers/TriggerForm";
import type { Trigger } from "../api/types";

function triggerTypeLabel(t: Trigger): string {
  if (t.trigger_type === "cron") return t.cron_expr ?? "cron";
  if (t.trigger_type === "whatsapp") return (t.config.phone as string) ?? "WhatsApp DM";
  return (t.config.group_jid as string) ?? "WhatsApp Group";
}

export function TriggersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { list, create, remove, toggle, runNow } = useTriggers();

  if (list.isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>Triggers</h1>
        <Button onClick={() => setModalOpen(true)}>New Trigger</Button>
      </div>

      {!list.data?.length ? (
        <EmptyState
          message="No triggers yet"
          cta={{ label: "Create Trigger", onClick: () => setModalOpen(true) }}
        />
      ) : (
        <Table>
          <thead>
            <Tr>
              <Th>Pipeline</Th>
              <Th>Type</Th>
              <Th>Schedule / Contact</Th>
              <Th>Enabled</Th>
              <Th>Actions</Th>
            </Tr>
          </thead>
          <tbody>
            {list.data.map((trigger) => (
              <Tr key={trigger.id}>
                <Td>{trigger.pipeline_name ?? trigger.pipeline_id}</Td>
                <Td>
                  <Badge
                    variant={
                      trigger.trigger_type === "cron"
                        ? "neutral"
                        : trigger.trigger_type === "whatsapp"
                        ? "success"
                        : "warning"
                    }
                  >
                    {trigger.trigger_type}
                  </Badge>
                </Td>
                <Td>{triggerTypeLabel(trigger)}</Td>
                <Td>
                  <input
                    type="checkbox"
                    checked={trigger.enabled}
                    aria-label="Toggle trigger enabled"
                    onChange={(e) => toggle.mutate({ id: trigger.id, enabled: e.target.checked })}
                  />
                </Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => runNow.mutate(trigger.id)}>
                    Run Now
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(trigger.id)}>
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Trigger">
        <TriggerForm
          onSubmit={async (data) => {
            await create.mutateAsync(data);
            setModalOpen(false);
          }}
          isSubmitting={create.isPending}
        />
      </Modal>
    </div>
  );
}
```

---

### 6. RunHistoryPage

**`src/pages/RunHistoryPage.tsx`**

```tsx
import { useState } from "react";
import { useRunRecords } from "../hooks/useRunRecords";
import { Table, Th, Td, Tr } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Select";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { EmptyState } from "../components/ui/EmptyState";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "running", label: "Running" },
];

function statusBadgeVariant(status: string) {
  if (status === "success") return "success" as const;
  if (status === "error") return "error" as const;
  if (status === "running") return "warning" as const;
  return "neutral" as const;
}

export function RunHistoryPage() {
  const [statusFilter, setStatusFilter] = useState("");

  const { data: runs, isLoading } = useRunRecords({
    status: statusFilter || undefined,
    refetchInterval: 10_000,   // auto-refresh every 10 seconds
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Run History</h1>
        <Select
          label="Filter by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      {!runs?.length ? (
        <EmptyState message="No runs recorded yet" />
      ) : (
        <Table>
          <thead>
            <Tr>
              <Th>Pipeline</Th>
              <Th>Timestamp</Th>
              <Th>Status</Th>
              <Th>Summary</Th>
            </Tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <Tr key={run.id}>
                <Td>{run.pipeline_name}</Td>
                <Td>{new Date(run.timestamp).toLocaleString()}</Td>
                <Td>
                  <Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
                </Td>
                <Td>{run.summary ?? "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
```

---

### 7. Component specs

All specs in `src/pages/__tests__/` and `src/components/triggers/__tests__/`.

Mock API modules as in Task 011.

#### `TriggersPage.test.tsx` — key cases

- Renders `LoadingSpinner` while loading
- Renders `EmptyState` when list is empty
- Renders a row for each trigger with type badge, schedule/contact column
- Toggle checkbox calls `triggersApi.toggle` with correct id and new enabled value
- Toggle checkbox updates the UI immediately (optimistic update) without waiting for server
- "Run Now" button calls `triggersApi.runNow` with the trigger id
- "Delete" button calls `triggersApi.delete` with the trigger id
- "New Trigger" button opens the modal
- Modal closes after successful form submission

#### `TriggerForm.test.tsx` — key cases

- Selecting "Cron Schedule" renders cron expression input
- Entering a valid cron expression renders a human-readable preview below the field
- Selecting "WhatsApp DM" renders phone number input; cron expression input is absent
- Selecting "WhatsApp Group" renders group selector; cron expression input is absent
- Submitting with no pipeline selected shows validation error
- Submitting a valid cron form calls `onSubmit` with correct shape including `cron_expr`
- Submitting a valid WhatsApp DM form calls `onSubmit` with `config.phone` set

#### `RunHistoryPage.test.tsx` — key cases

- Renders a row for each run record with correct status badge
- "Success" status renders `Badge` with `variant="success"`
- "Error" status renders `Badge` with `variant="error"`
- Filtering by "error" calls `runRecordsApi.list` with `{ status: "error" }`
- Page auto-refreshes (verify `refetchInterval` is passed to `useQuery` — mock timer or check options)

---

## File / class list

| Path | Description |
|---|---|
| `src/hooks/useTriggers.ts` | React Query mutations + queries with optimistic toggle |
| `src/hooks/useRunRecords.ts` | `useQuery` wrapper with optional status filter and refetchInterval |
| `src/pages/TriggersPage.tsx` | Trigger table + New Trigger modal |
| `src/pages/RunHistoryPage.tsx` | Run records table with status filter and auto-refresh |
| `src/components/triggers/TriggerForm.tsx` | Polymorphic form for cron/whatsapp/wa_group triggers |
| `src/components/triggers/CronPreview.tsx` | Human-readable cron description via cronstrue |
| `src/pages/__tests__/TriggersPage.test.tsx` | TriggersPage specs |
| `src/pages/__tests__/RunHistoryPage.test.tsx` | RunHistoryPage specs |
| `src/components/triggers/__tests__/TriggerForm.test.tsx` | TriggerForm specs |

---

## Acceptance criteria

- [ ] Navigating to `/triggers` shows the triggers table (or empty state)
- [ ] "New Trigger" button opens a modal
- [ ] Selecting "Cron Schedule" in the modal shows cron expression input and human-readable preview
- [ ] Selecting "WhatsApp DM" shows phone number input; cron fields are hidden
- [ ] Selecting "WhatsApp Group" shows a group selector dropdown; cron fields are hidden
- [ ] Submitting the cron form creates a trigger and closes the modal
- [ ] Toggling the enabled checkbox updates the row immediately without a page reload (optimistic UI)
- [ ] If the toggle API call fails, the checkbox reverts to its previous state
- [ ] "Run Now" fires a toast "Trigger run queued" on success
- [ ] "Delete" removes the trigger from the table
- [ ] Navigating to `/runs` shows the run history table
- [ ] Status filter dropdown narrows the displayed rows
- [ ] Run history page auto-refreshes every 10 seconds (status badge updates if a running job completes)
- [ ] `npx vitest run` passes all specs in this task with zero failures
