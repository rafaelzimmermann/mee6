import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";

export function useAgentSchema() {
  return useQuery({
    queryKey: ["agent_schema"],
    queryFn: agentsApi.getSchema,
    staleTime: Infinity,
  });
}
