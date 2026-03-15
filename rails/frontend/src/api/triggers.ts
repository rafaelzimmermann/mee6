import { api } from "./client";
import type { Trigger } from "./types";

export const triggersApi = {
  list: () => api.get<Trigger[]>("/triggers"),
  create: (data: Partial<Trigger>) => api.post<Trigger>("/triggers", { trigger: data }),
  update: (id: string, data: Partial<Trigger>) =>
    api.put<Trigger>(`/triggers/${id}`, { trigger: data }),
  delete: (id: string) => api.delete(`/triggers/${id}`),
  toggle: (id: string, enabled: boolean) =>
    api.patch<Trigger>(`/triggers/${id}`, { trigger: { enabled } }),
  runNow: (id: string) => api.post<{ ok: boolean }>(`/triggers/${id}/run_now`),
};
