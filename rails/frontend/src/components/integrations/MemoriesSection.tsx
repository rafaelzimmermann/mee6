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

const LABEL_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function MemoriesSection() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewingLabel, setViewingLabel] = useState<string | null>(null);

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: memoriesApi.list,
  });

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

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Memory Config">
        <form onSubmit={handleSubmit(onCreateSubmit)}>
          <Input
            id="label"
            label="Label"
            placeholder="my-memory"
            error={errors.label?.message}
            {...register("label", {
              required: "Label is required",
              pattern: { value: LABEL_PATTERN, message: "Only letters, numbers, hyphens, underscores" },
            })}
          />
          <Input
            id="max_memories"
            label="Max Memories"
            type="number"
            error={errors.max_memories?.message}
            {...register("max_memories", { valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
          />
          <Input
            id="ttl_hours"
            label="TTL (hours)"
            type="number"
            error={errors.ttl_hours?.message}
            {...register("ttl_hours", { valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
          />
          <Input
            id="max_value_size"
            label="Max Value Size (chars)"
            type="number"
            error={errors.max_value_size?.message}
            {...register("max_value_size", { valueAsNumber: true, min: { value: 1, message: "Min 1" } })}
          />
          <Button type="submit" loading={createMutation.isPending}>Create</Button>
        </form>
      </Modal>

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

function MemoryEntryCount({ label }: { label: string }) {
  const { data } = useQuery({
    queryKey: ["memory_entries", label],
    queryFn: () => memoriesApi.entries(label, 500),
    staleTime: 60_000,
  });
  if (data === undefined) return <span>—</span>;
  return <span>{data.length}</span>;
}

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
