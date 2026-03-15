import { useQuery } from "@tanstack/react-query";
import { runRecordsApi } from "../api/runRecords";

interface UseRunRecordsOptions {
  status?: string;
  limit?: number;
  refetchInterval?: number;
}

export function useRunRecords(options: UseRunRecordsOptions = {}) {
  const { status, limit, refetchInterval = 0 } = options;

  return useQuery({
    queryKey: ["run_records", { status, limit }],
    queryFn: () => runRecordsApi.list({ status, limit }),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
  });
}
