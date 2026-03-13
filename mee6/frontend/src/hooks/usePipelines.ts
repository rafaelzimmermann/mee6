import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PipelineCreateRequest } from "@/lib/api";

export function usePipelines() {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: api.pipelines.list,
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: ["pipelines", id],
    queryFn: () => api.pipelines.get(id),
    enabled: !!id,
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PipelineCreateRequest) => api.pipelines.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PipelineCreateRequest }) =>
      api.pipelines.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["pipelines", id] });
    },
  });
}

export function useDeletePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.pipelines.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}
