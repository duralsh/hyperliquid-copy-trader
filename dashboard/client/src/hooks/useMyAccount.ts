import { useQuery } from "@tanstack/react-query";
import { fetchMyAccount } from "../services/api.js";

export function useMyAccount() {
  return useQuery({
    queryKey: ["myAccount"],
    queryFn: fetchMyAccount,
    refetchInterval: 15_000,
    retry: 1,
  });
}
