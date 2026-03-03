import { useState, useEffect } from "react";
import { useStopBot } from "../../hooks/useBotStatus.js";
import { shortenAddress, formatElapsed } from "../../utils/format.js";
import type { BotStatus } from "../../../../shared/types.js";

interface Props {
  status: BotStatus | null;
  wsConnected: boolean;
}

export function StatusPanel({ status, wsConnected }: Props) {
  const stopBot = useStopBot();
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!status?.startedAt) {
      setElapsed("");
      return;
    }
    const tick = () => setElapsed(formatElapsed(Date.now() - status.startedAt!));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.startedAt]);

  const running = status?.running ?? false;

  return (
    <div className="border-t border-border bg-bg-secondary px-4 py-2 flex items-center gap-4 text-xs shrink-0">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${running ? "bg-green animate-pulse" : "bg-text-dim"}`} />
        <span className={running ? "text-green" : "text-text-dim"}>
          {">"} {running ? "bot running..." : "bot stopped"}
          <span className="cursor-blink">█</span>
        </span>
      </div>

      {/* Details when running */}
      {running && status && (
        <>
          <div className="text-text-dim">
            target: <span className="text-amber">{shortenAddress(status.targetWallet ?? "")}</span>
          </div>
          <div className="text-text-dim">
            trades: <span className="text-text">{status.activeTradesCount}</span>
          </div>
          {elapsed && (
            <div className="text-text-dim">
              uptime: <span className="text-text tabular-nums">{elapsed}</span>
            </div>
          )}
          {status.config?.dryRun && (
            <span className="text-amber border border-amber/30 px-1.5 py-0.5 rounded text-[10px]">
              DRY RUN
            </span>
          )}
          <button
            onClick={() => stopBot.mutate()}
            disabled={stopBot.isPending}
            className="ml-auto border border-red text-red hover:bg-red/10 px-3 py-1 rounded transition-colors"
          >
            {stopBot.isPending ? "stopping..." : "[STOP]"}
          </button>
        </>
      )}

      {/* WS status */}
      <div className={`${running ? "" : "ml-auto"} flex items-center gap-1`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green" : "bg-red"}`} />
        <span className="text-text-dim">ws</span>
      </div>
    </div>
  );
}
