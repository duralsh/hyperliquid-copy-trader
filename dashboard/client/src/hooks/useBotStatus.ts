import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBotStatus, fetchBotTrades, startBot, stopBot } from "../services/api.js";
import type { BotConfig } from "../../../shared/types.js";

export function useBotStatus() {
  return useQuery({
    queryKey: ["botStatus"],
    queryFn: fetchBotStatus,
    refetchInterval: 10_000,
  });
}

export function useBotTrades() {
  return useQuery({
    queryKey: ["botTrades"],
    queryFn: fetchBotTrades,
  });
}

export function useStartBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: BotConfig) => startBot(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["botStatus"] }),
  });
}

export function useStopBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => stopBot(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["botStatus"] }),
  });
}
