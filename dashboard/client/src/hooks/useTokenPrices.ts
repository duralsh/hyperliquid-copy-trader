import { useQuery } from "@tanstack/react-query";
import type { TokenPrice } from "../../../shared/types.js";

export function useTokenPrices() {
  return useQuery<TokenPrice[]>({
    queryKey: ["tokenPrices"],
    queryFn: async () => {
      const res = await fetch("/api/prices");
      if (!res.ok) throw new Error("Failed to fetch prices");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
