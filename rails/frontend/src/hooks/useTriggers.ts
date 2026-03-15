import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { triggersApi } from "../api/triggers";
import { showSuccess, showError } from "../lib/toast";
import type { Trigger } from "../api/types";

export function useTriggers() {
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["triggers"],
    queryFn: triggersApi.list,
  });

  const create = useMutation({
    mutationFn: triggersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      showSuccess("Trigger created");
    },
    onError: (err: Error) => showError(err.message),
  });

  const remove = useMutation({
    mutationFn: triggersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      showSuccess("Trigger deleted");
    },
    onError: (err: Error) => showError(err.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      triggersApi.toggle(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["triggers"] });
      const previous = queryClient.getQueryData<Trigger[]>(["triggers"]);
      queryClient.setQueryData<Trigger[]>(["triggers"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, enabled } : t)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["triggers"], context.previous);
      }
      showError("Failed to update trigger");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
  });

  const runNow = useMutation({
    mutationFn: triggersApi.runNow,
    onSuccess: () => showSuccess("Trigger run queued"),
    onError: (err: Error) => showError(err.message),
  });

  return { list, create, remove, toggle, runNow };
}
