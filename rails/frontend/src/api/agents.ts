import { api } from "./client";
import type { SchemaResponse } from "./types";

export const agentsApi = {
  getSchema: () => api.get<SchemaResponse>("/agents/schema"),
};
