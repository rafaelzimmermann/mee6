import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappApi, type WhatsAppStatus } from "../../api/integrations/whatsapp";
import { triggersApi } from "../../api/triggers";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { Input } from "../ui/Input";
import { Table, Th, Td, Tr } from "../ui/Table";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { showSuccess, showError } from "../../lib/toast";
import type { WhatsAppGroup, Trigger } from "../../api/types";

function statusBadgeVariant(status: string) {
  if (status === "connected") return "success" as const;
  if (status === "error") return "error" as const;
  if (status === "pending_qr") return "warning" as const;
  return "neutral" as const;
}

export function WhatsAppSection() {
  const queryClient = useQueryClient();

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["whatsapp_status"],
    queryFn: whatsappApi.status,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "connected" ? false : 5_000;
    },
  });

  const { data: settingsData } = useQuery({
    queryKey: ["whatsapp_settings"],
    queryFn: whatsappApi.settings,
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
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["whatsapp_groups"] }), 2_000);
      showSuccess("Sync started");
    },
    onError: (err: Error) => showError(err.message),
  });

  if (statusLoading) return <LoadingSpinner />;

  return (
    <div>
      <h2>WhatsApp</h2>

      <ConnectionStatusCard
        statusData={statusData}
        onConnect={() => connectMutation.mutate()}
        onDisconnect={() => disconnectMutation.mutate()}
        isConnecting={connectMutation.isPending}
        isDisconnecting={disconnectMutation.isPending}
      />

      <PhoneNumberCard phoneNumber={settingsData?.phone_number ?? ""} />

      <GroupsCard
        groups={groups}
        groupsLoading={groupsLoading}
        onSync={() => syncMutation.mutate()}
        isSyncing={syncMutation.isPending}
      />
    </div>
  );
}

interface ConnectionStatusCardProps {
  statusData: WhatsAppStatus | undefined;
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

function PhoneNumberCard({ phoneNumber }: { phoneNumber: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phoneNumber);

  const updateMutation = useMutation({
    mutationFn: (phone: string) => whatsappApi.updateSettings({ phone_number: phone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_settings"] });
      showSuccess("Phone number saved");
      setEditing(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  return (
    <Card className="mt-4">
      <CardHeader>Phone Number</CardHeader>
      <CardBody>
        {editing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              id="phone_number"
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

const PAGE_SIZE = 25;

function GroupsCard({
  groups, groupsLoading, onSync, isSyncing,
}: {
  groups: WhatsAppGroup[] | undefined;
  groupsLoading: boolean;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const { data: triggers } = useQuery({
    queryKey: ["triggers"],
    queryFn: triggersApi.list,
  });

  const monitoredJids = new Set(
    (triggers ?? [])
      .filter((t: Trigger) => t.trigger_type === "wa_group" && t.enabled)
      .map((t: Trigger) => t.config.group_jid as string)
      .filter(Boolean)
  );

  return (
    <Card className="mt-6">
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>WhatsApp Groups</span>
          <Button size="sm" variant="secondary" onClick={onSync} loading={isSyncing}>
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
          <GroupsTable groups={groups} monitoredJids={monitoredJids} />
        )}
      </CardBody>
    </Card>
  );
}

function GroupsTable({ groups, monitoredJids }: { groups: WhatsAppGroup[]; monitoredJids: Set<string> }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const updateLabelMutation = useMutation({
    mutationFn: ({ jid, label }: { jid: string; label: string }) =>
      whatsappApi.updateGroupLabel(jid, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_groups"] });
      showSuccess("Alias saved");
    },
    onError: (err: Error) => showError(err.message),
  });

  const q = query.toLowerCase();
  const filtered = groups
    .filter((g) => !q || g.name.toLowerCase().includes(q) || g.jid.includes(q))
    .sort((a, b) => {
      const aM = monitoredJids.has(a.jid), bM = monitoredJids.has(b.jid);
      if (aM !== bM) return aM ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const monitoredCount = groups.filter((g) => monitoredJids.has(g.jid)).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input
          type="search"
          placeholder="Search by name or JID…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14 }}
          aria-label="Search groups"
        />
        {monitoredCount > 0 && (
          <span style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>
            {monitoredCount} monitored
          </span>
        )}
      </div>

      <Table>
        <thead>
          <Tr>
            <Th>Name</Th>
            <Th>Status</Th>
          </Tr>
        </thead>
        <tbody>
          {visible.map((group) => (
            <GroupRow
              key={group.jid}
              group={group}
              monitored={monitoredJids.has(group.jid)}
              onSaveLabel={(label) => updateLabelMutation.mutate({ jid: group.jid, label })}
              isSaving={updateLabelMutation.isPending}
            />
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={2} style={{ textAlign: "center", color: "#9ca3af", padding: "16px" }}>No groups match your search.</td></tr>
          )}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 13, color: "#6b7280" }}>
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={safePage === 0}>
            Previous
          </Button>
          <span>Page {safePage + 1} of {totalPages} ({filtered.length} groups)</span>
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={safePage >= totalPages - 1}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function GroupRow({
  group, monitored, onSaveLabel, isSaving,
}: {
  group: WhatsAppGroup;
  monitored: boolean;
  onSaveLabel: (label: string) => void;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState(group.label ?? "");

  return (
    <Tr className={monitored ? "bg-green-50" : undefined}>
      <Td>
        <div>
          <div style={{ fontWeight: monitored ? 600 : undefined }}>{group.name}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{group.jid}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Alias…"
              aria-label={`Alias for group ${group.name}`}
              style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12, width: 140 }}
            />
            <Button size="sm" onClick={() => onSaveLabel(label)} loading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      </Td>
      <Td>
        {monitored && <Badge variant="success">Monitored</Badge>}
      </Td>
    </Tr>
  );
}
