import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappApi, type WhatsAppStatus } from "../../api/integrations/whatsapp";
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

      <PhoneNumberCard phoneNumber={statusData?.phone_number ?? ""} />

      <Card className="mt-6">
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
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
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
            id={`group-label-${group.jid}`}
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
