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
