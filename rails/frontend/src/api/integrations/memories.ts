import { api } from "../client";
import type { Memory, MemoryEntry } from "../types";

export const memoriesApi = {
  list: () => api.get<Memory[]>("/integrations/memories"),
  get: (label: string) => api.get<Memory>(`/integrations/memories/${label}`),
  create: (data: Omit<Memory, "id" | "created_at">) =>
    api.post<Memory>("/integrations/memories", { memory: data }),
  delete: (label: string) => api.delete(`/integrations/memories/${label}`),
  entries: (label: string, n?: number) =>
    api.get<MemoryEntry[]>(`/integrations/memories/${label}/entries${n ? `?n=${n}` : ""}`),
};
