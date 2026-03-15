import { api } from "./client";
import type { Pipeline } from "./types";

export const pipelinesApi = {
  list: () => api.get<Pipeline[]>("/pipelines"),
  get: (id: string) => api.get<Pipeline>(`/pipelines/${id}`),
  create: (data: { name: string; pipeline_steps_attributes?: unknown[] }) =>
    api.post<Pipeline>("/pipelines", { pipeline: data }),
  update: (id: string, data: Partial<Pipeline>) =>
    api.put<Pipeline>(`/pipelines/${id}`, { pipeline: data }),
  delete: (id: string) => api.delete(`/pipelines/${id}`),
  runNow: (id: string) => api.post<{ ok: boolean }>(`/pipelines/${id}/run_now`),
};
