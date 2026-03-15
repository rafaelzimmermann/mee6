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
            id="label"
            label="Label"
            placeholder="My Work Calendar"
            error={errors.label?.message}
            {...register("label", { required: "Label is required" })}
          />
          <Input
            id="calendar_id"
            label="Calendar ID"
            placeholder="user@example.com"
            error={errors.calendar_id?.message}
            {...register("calendar_id", { required: "Calendar ID is required" })}
          />
          <Input
            id="credentials_file"
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
