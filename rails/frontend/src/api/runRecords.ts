import { api } from "./client";
import type { RunRecord } from "./types";

export const runRecordsApi = {
  list: (params?: { status?: string; limit?: number }) => {
    const qs = params
      ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
      : "";
    return api.get<RunRecord[]>(`/run_records${qs}`);
  },
};
