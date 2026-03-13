import { Link } from "react-router-dom";
import { usePipelines, useDeletePipeline } from "@/hooks/usePipelines";
import { Button } from "@/components/common/Button";
import { Layout } from "@/components/common/Layout";
import { Trash2, Play } from "lucide-react";

export function PipelineList() {
  const { data: pipelines, isLoading, error } = usePipelines();
  const deletePipeline = useDeletePipeline();

  if (isLoading) {
    return (
      <Layout title="Pipelines">
        <div className="text-center py-12">Loading...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Pipelines">
        <div className="text-center py-12 text-red-500">
          Error loading pipelines: {error.message}
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Pipelines"
      actions={
        <Link to="/pipelines/new">
          <Button>+ New Pipeline</Button>
        </Link>
      }
    >
      {pipelines && pipelines.length > 0 ? (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {pipeline.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {pipeline.steps.length} step{pipeline.steps.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Link to={`/pipelines/${pipeline.id}`}>
                    <Button variant="secondary" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete "${pipeline.name}"?`
                        )
                      ) {
                        deletePipeline.mutate(pipeline.id);
                      }
                    }}
                    disabled={deletePipeline.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No pipelines yet. Create your first pipeline to get started.
        </div>
      )}
    </Layout>
  );
}
