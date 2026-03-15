import { useQuery } from "@tanstack/react-query";
import { pipelinesApi, triggersApi, runRecordsApi } from "../api";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Table, Th, Td, Tr } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export function DashboardPage() {
  const { data: pipelines, isLoading: pipelinesLoading } = useQuery({
    queryKey: ["pipelines"],
    queryFn: pipelinesApi.list,
  });
  const { data: triggers, isLoading: triggersLoading } = useQuery({
    queryKey: ["triggers"],
    queryFn: triggersApi.list,
  });
  const { data: runRecords, isLoading: runsLoading } = useQuery({
    queryKey: ["run_records", { limit: 5 }],
    queryFn: () => runRecordsApi.list({ limit: 5 }),
  });

  const isLoading = pipelinesLoading || triggersLoading || runsLoading;
  const lastRun = runRecords && runRecords.length > 0 ? runRecords[0] : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-700">Pipelines</h2>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-bold text-gray-900">{pipelines?.length ?? 0}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-700">Triggers</h2>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-bold text-gray-900">{triggers?.length ?? 0}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-700">Last Run</h2>
          </CardHeader>
          <CardBody>
            {lastRun ? (
              <Badge variant={lastRun.status === "success" ? "success" : lastRun.status === "error" ? "error" : "neutral"}>
                {lastRun.status}
              </Badge>
            ) : (
              <p className="text-gray-500">No runs yet</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-700">Recent Runs</h2>
        </CardHeader>
        <CardBody>
          {runRecords && runRecords.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Pipeline</Th>
                  <Th>Timestamp</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {runRecords.map((run) => (
                  <Tr key={run.id}>
                    <Td>{run.pipeline_name}</Td>
                    <Td>{new Date(run.timestamp).toLocaleString()}</Td>
                    <Td>
                      <Badge variant={run.status === "success" ? "success" : run.status === "error" ? "error" : "neutral"}>
                        {run.status}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">No runs yet</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
