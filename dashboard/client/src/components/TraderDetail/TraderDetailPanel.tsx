import { useQuery } from "@tanstack/react-query";
import { fetchTraderPositions } from "../../services/api.js";
import { formatUSD, formatPnl, shortenAddress } from "../../utils/format.js";
import type { TraderSummary, BotConfig } from "../../../../shared/types.js";

interface Props {
  trader: TraderSummary;
  onClose: () => void;
  onCopy: (config: Partial<BotConfig>) => void;
}

export function TraderDetailPanel({ trader, onClose, onCopy }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["traderDetail", trader.address],
    queryFn: () => fetchTraderPositions(trader.address),
  });

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-bg-secondary border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-green text-sm">
            {">"} trader_detail <span className="cursor-blink">█</span>
          </div>
          <div className="text-amber text-lg mt-1">
            {trader.displayName || shortenAddress(trader.address)}
          </div>
          <div className="text-text-dim text-xs font-mono">{trader.address}</div>
        </div>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-red text-xl px-2 transition-colors"
        >
          [x]
        </button>
      </div>

      {/* Account summary */}
      <div className="p-4 border-b border-border">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-text-dim">ACCOUNT VALUE</div>
            <div className="text-green text-lg tabular-nums">{formatUSD(trader.accountValue)}</div>
          </div>
          {data && (
            <>
              <div>
                <div className="text-text-dim">MARGIN USED</div>
                <div className="text-amber text-lg tabular-nums">{formatUSD(parseFloat(data.totalMarginUsed))}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-text-dim">ALL-TIME PNL</div>
            <div className={`text-lg tabular-nums ${trader.pnl.allTime >= 0 ? "text-green" : "text-red"}`}>
              {formatPnl(trader.pnl.allTime)}
            </div>
          </div>
          <div>
            <div className="text-text-dim">MONTH PNL</div>
            <div className={`text-lg tabular-nums ${trader.pnl.month >= 0 ? "text-green" : "text-red"}`}>
              {formatPnl(trader.pnl.month)}
            </div>
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className="flex-1 overflow-auto p-4">
        <div className="text-text-dim text-xs mb-2">
          {">"} OPEN POSITIONS {data ? `[${data.positions.length}]` : ""}
        </div>

        {isLoading && (
          <div className="text-green text-xs py-4">Loading positions...</div>
        )}

        {error && (
          <div className="text-red text-xs py-4">ERR: {(error as Error).message}</div>
        )}

        {data && data.positions.length === 0 && (
          <div className="text-text-dim text-xs py-4">No open positions</div>
        )}

        {data && data.positions.map((pos) => {
          const size = parseFloat(pos.szi);
          const isLong = size > 0;
          const pnl = parseFloat(pos.unrealizedPnl);
          const notional = Math.abs(size) * parseFloat(pos.entryPx);

          return (
            <div
              key={pos.coin}
              className="border border-border/50 rounded p-3 mb-2 hover:border-green/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-amber font-bold text-sm">{pos.coin}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${isLong ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                    {isLong ? "LONG" : "SHORT"}
                  </span>
                  <span className="text-text-dim text-xs">{pos.leverage}x</span>
                </div>
                <span className={`text-xs tabular-nums ${pnl >= 0 ? "text-green" : "text-red"}`}>
                  {formatPnl(pnl)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-text-dim">
                <div>
                  <span>SIZE: </span>
                  <span className="text-text tabular-nums">{Math.abs(size).toFixed(4)}</span>
                </div>
                <div>
                  <span>ENTRY: </span>
                  <span className="text-text tabular-nums">${parseFloat(pos.entryPx).toFixed(2)}</span>
                </div>
                <div>
                  <span>NTL: </span>
                  <span className="text-text tabular-nums">{formatUSD(notional)}</span>
                </div>
                <div>
                  <span>LIQ: </span>
                  <span className="text-amber tabular-nums">${parseFloat(pos.liquidationPx).toFixed(2)}</span>
                </div>
                <div>
                  <span>MARGIN: </span>
                  <span className="text-text tabular-nums">{formatUSD(parseFloat(pos.marginUsed))}</span>
                </div>
                <div>
                  <span>ROE: </span>
                  <span className={`tabular-nums ${parseFloat(pos.returnOnEquity) >= 0 ? "text-green" : "text-red"}`}>
                    {(parseFloat(pos.returnOnEquity) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Copy button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => onCopy({ targetWallet: trader.address })}
          className="w-full py-3 bg-green/10 border border-green text-green hover:bg-green/20 transition-colors text-sm rounded"
        >
          {">"} COPY THIS TRADER
        </button>
      </div>
    </div>
  );
}
