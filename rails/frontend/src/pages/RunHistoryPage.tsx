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
    refetchInterval: 10_000,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Run History</h1>
        <Select
          id="status_filter"
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
