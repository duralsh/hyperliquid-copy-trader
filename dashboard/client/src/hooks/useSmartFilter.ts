import { useQuery } from "@tanstack/react-query";
import { fetchSmartFilter } from "../services/api.js";

export function useSmartFilter(enabled: boolean) {
  return useQuery({
    queryKey: ["smartFilter"],
    queryFn: () => fetchSmartFilter(),
    enabled,
    refetchInterval: 5 * 60_000,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}
