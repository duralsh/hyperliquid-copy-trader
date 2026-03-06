import { useRef, useEffect } from "react";
import type { BotTradeEvent } from "../../../../shared/types.js";

interface Props {
  trades: BotTradeEvent[];
  visible: boolean;
  onToggle: () => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function TradeLog({ trades, visible, onToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [trades.length]);

  return (
    <div className={`border-t border-border/40 transition-all duration-300 ${visible ? "h-52" : "h-8"}`} style={{ background: "linear-gradient(180deg, var(--color-bg-secondary) 0%, var(--color-bg) 100%)" }}>
      {/* Toggle bar */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-1.5 text-xs text-text-dim hover:text-text flex items-center gap-2 transition-colors duration-200"
        style={{ background: "linear-gradient(90deg, rgba(30, 42, 53, 0.3) 0%, transparent 100%)" }}
      >
        <span>{visible ? "\u25BC" : "\u25B2"}</span>
        <span>{">"} trade_log [{trades.length}]{trades.length > 0 && (
          <span className="cursor-blink text-green">\u2588</span>
        )}</span>
      </button>

      {/* Log entries */}
      {visible && (
        <div ref={scrollRef} className="overflow-auto h-[calc(100%-32px)] px-4 pb-2">
          {trades.length === 0 && (
            <div className="text-text-dim text-xs py-2">No trades yet. Start the bot to see activity here.</div>
          )}
          {trades.map((t, i) => {
            const isOpen = t.type === "trade" && t.action === "open";
            const borderColor = t.type === "trade"
              ? (isOpen ? "rgba(0, 255, 65, 0.4)" : "rgba(255, 0, 64, 0.4)")
              : "rgba(255, 176, 0, 0.4)";

            return (
              <div
                key={i}
                className="text-[11px] font-mono py-0.5 flex items-center gap-2 transition-colors duration-150"
                style={{
                  borderLeft: `2px solid ${borderColor}`,
                  paddingLeft: "8px",
                  marginBottom: "1px",
                }}
              >
                <span className="text-text-dim tabular-nums">{formatTime(t.timestamp)}</span>
                {t.type === "trade" ? (
                  <>
                    <span className={t.action === "open" ? "text-green" : "text-red"}>
                      {t.action === "open" ? "OPEN" : "CLOSE"}
                    </span>
                    <span className="text-amber">{t.coin}</span>
                    <span className="text-text-dim">{t.side === "B" ? "LONG" : "SHORT"}</span>
                    <span className="text-text tabular-nums">sz:{t.size}</span>
                    <span className="text-text tabular-nums">px:{t.price}</span>
                    {t.orderId && <span className="text-text-dim">oid:{t.orderId}</span>}
                  </>
                ) : (
                  <>
                    <span className="text-amber">ERR</span>
                    <span className="text-red">{t.error}</span>
                    {t.coin && <span className="text-text-dim">({t.coin})</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
