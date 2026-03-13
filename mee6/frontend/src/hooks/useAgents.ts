import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: api.agents.list,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useAllAgentFields() {
  const { data: agents } = useAgents();

  return useQuery({
    queryKey: ["agent-fields", "all"],
    queryFn: api.agents.getAllFields,
    enabled: !!agents && agents.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

export function useAgentFields(agentType: string, allFields?: Record<string, typeof import("@/lib/api").FieldSchema[]>) {
  return useQuery({
    queryKey: ["agent-fields", agentType],
    queryFn: () => api.agents.getFields(agentType),
    enabled: !!agentType && !allFields, // Only fetch individual if batch data not available
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    initialData: allFields?.[agentType], // Use cached batch data
  });
}
