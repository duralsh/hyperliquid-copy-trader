import { useQuery } from "@tanstack/react-query";
import { fetchWalletBalances } from "../services/api.js";

export function useWalletBalances() {
  return useQuery({
    queryKey: ["walletBalances"],
    queryFn: fetchWalletBalances,
    refetchInterval: 30_000,
    retry: 1,
  });
}
