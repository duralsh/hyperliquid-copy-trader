import { useState, useEffect } from "react";
import { useStopBot } from "../../hooks/useBotStatus.js";
import { shortenAddress, formatElapsed } from "../../utils/format.js";
import { CopyButton } from "../CopyButton.js";
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
    <div
      className="border-t border-border/40 px-4 py-2 flex items-center gap-4 text-xs shrink-0"
      style={{
        background: "linear-gradient(180deg, rgba(15, 20, 25, 0.9) 0%, rgba(10, 14, 20, 0.95) 100%)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 -1px 8px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${running ? "bg-green" : "bg-text-dim"}`}
          style={running ? {
            animation: "glow-pulse 2s ease-in-out infinite",
            boxShadow: "0 0 6px rgba(0, 255, 65, 0.6), 0 0 12px rgba(0, 255, 65, 0.3)",
          } : {}}
        />
        <span className={running ? "text-green" : "text-text-dim"}>
          {">"} {running ? "bot running" : "bot stopped"}<span className="cursor-blink">█</span>
        </span>
      </div>

      {/* Details when running */}
      {running && status && (
        <>
          <div className="text-text-dim">
            target: <span className="text-amber inline-flex items-center gap-1">{shortenAddress(status.targetWallet ?? "")}<CopyButton text={status.targetWallet ?? ""} /></span>
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
            <span
              className="text-amber border border-amber/30 px-1.5 py-0.5 rounded text-[10px]"
              style={{ boxShadow: "0 0 6px rgba(255, 176, 0, 0.15)" }}
            >
              DRY RUN
            </span>
          )}
          <button
            onClick={() => stopBot.mutate()}
            disabled={stopBot.isPending}
            className="ml-auto border border-red text-red px-3 py-1 rounded transition-all duration-200 hover:bg-red/10"
            style={{ boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)" }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.boxShadow = "0 0 12px rgba(255, 0, 64, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.boxShadow = "inset 0 1px 0 rgba(255, 255, 255, 0.05)"; }}
          >
            {stopBot.isPending ? "stopping..." : "[STOP]"}
          </button>
        </>
      )}

      {/* WS status */}
      <div className={`${running ? "" : "ml-auto"} flex items-center gap-1`}>
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green" : "bg-red"}`}
          style={wsConnected ? { boxShadow: "0 0 4px rgba(0, 255, 65, 0.5)" } : { boxShadow: "0 0 4px rgba(255, 0, 64, 0.5)" }}
        />
        <span className="text-text-dim">ws</span>
      </div>
    </div>
  );
}
