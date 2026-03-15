import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelinesApi } from "../api/pipelines";
import { showSuccess, showError } from "../lib/toast";
import type { Pipeline } from "../api/types";

export function usePipelines() {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["pipelines"],
    queryFn: pipelinesApi.list,
  });

  const create = useMutation({
    mutationFn: (data: Parameters<typeof pipelinesApi.create>[0]) => pipelinesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      showSuccess("Pipeline created");
    },
    onError: (err: Error) => showError(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pipeline> }) =>
      pipelinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      showSuccess("Pipeline saved");
    },
    onError: (err: Error) => showError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => pipelinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      showSuccess("Pipeline deleted");
    },
    onError: (err: Error) => showError(err.message),
  });

  const runNow = useMutation({
    mutationFn: (id: string) => pipelinesApi.runNow(id),
    onSuccess: () => showSuccess("Pipeline run triggered"),
    onError: (err: Error) => showError(err.message),
  });

  return { list, create, update, remove, runNow };
}
