import { usePipelines } from "../hooks/usePipelines";
import { Table, Th, Td, Tr } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useNavigate } from "react-router-dom";

export function PipelinesPage() {
  const navigate = useNavigate();
  const { list, remove, runNow } = usePipelines();

  if (list.isLoading) return <LoadingSpinner />;

  if (!list.data?.length) {
    return (
      <EmptyState
        message="No pipelines yet"
        cta={{ label: "Create Pipeline", onClick: () => navigate("/pipelines/new") }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>Pipelines</h1>
        <Button onClick={() => navigate("/pipelines/new")}>New Pipeline</Button>
      </div>

      <Table>
        <thead>
          <Tr>
            <Th>Name</Th>
            <Th>Steps</Th>
            <Th>Actions</Th>
          </Tr>
        </thead>
        <tbody>
          {list.data.map((pipeline) => (
            <Tr key={pipeline.id}>
              <Td>{pipeline.name}</Td>
              <Td>{pipeline.pipeline_steps.length}</Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/pipelines/${pipeline.id}/edit`)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => runNow.mutate(pipeline.id)}>
                  Run Now
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove.mutate(pipeline.id)}>
                  Delete
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
