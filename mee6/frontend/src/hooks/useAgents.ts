import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: api.agents.list,
  });
}

export function useAgentFields(agentType: string) {
  return useQuery({
    queryKey: ["agent-fields", agentType],
    queryFn: () => api.agents.getFields(agentType),
    enabled: !!agentType,
  });
}
