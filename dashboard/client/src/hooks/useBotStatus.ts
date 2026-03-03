import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startBot, stopBot } from "../services/api.js";
import type { BotConfig } from "../../../shared/types.js";

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
