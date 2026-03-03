import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTraderPositions, fetchTraderFills } from "../../services/api.js";
import { formatUSD, formatPnl, shortenAddress, formatTimeAgo } from "../../utils/format.js";
import { CopyButton } from "../CopyButton.js";
import { StarButton } from "../StarButton.js";
import { useStopBot } from "../../hooks/useBotStatus.js";
import type { TraderSummary, BotConfig } from "../../../../shared/types.js";

interface Props {
  trader: TraderSummary;
  onClose: () => void;
  onCopy: (config: Partial<BotConfig>) => void;
  activeCopyTarget: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

function StopCopyButton() {
  const [hovered, setHovered] = useState(false);
  const stopBot = useStopBot();

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => stopBot.mutate()}
      disabled={stopBot.isPending}
      className={`w-full py-4 font-bold text-sm rounded tracking-wider text-center transition-all cursor-pointer border ${
        stopBot.isPending
          ? "bg-amber/15 border-amber/40 text-amber opacity-70 cursor-not-allowed"
          : hovered
            ? "bg-red/15 border-red/40 text-red shadow-[0_0_20px_rgba(255,0,64,0.2)]"
            : "bg-green/15 border-green/40 text-green"
      }`}
    >
      {stopBot.isPending
        ? "> STOPPING _"
        : hovered
          ? "> STOP COPYING _"
          : "> CURRENTLY COPYING _"}
    </button>
  );
}

export function TraderDetailPanel({ trader, onClose, onCopy, activeCopyTarget, isFavorite, onToggleFavorite }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["traderDetail", trader.address],
    queryFn: () => fetchTraderPositions(trader.address),
  });

  const { data: fills, isLoading: fillsLoading, error: fillsError } = useQuery({
    queryKey: ["traderFills", trader.address],
    queryFn: () => fetchTraderFills(trader.address),
  });

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-bg-secondary border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-green text-sm">
            {">"} trader_detail<span className="cursor-blink">█</span>
          </div>
          <div className="text-amber text-lg mt-1 flex items-center gap-1.5">
            <StarButton active={isFavorite} onClick={onToggleFavorite} />
            {trader.displayName || shortenAddress(trader.address)}
            <CopyButton text={trader.address} />
          </div>
          <div className="text-text-dim text-xs font-mono flex items-center gap-1.5">
            {trader.address}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-red p-1.5 rounded hover:bg-red/10 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
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

      {/* Copy button */}
      <div className="px-4 pt-4 pb-2">
        {activeCopyTarget?.toLowerCase() === trader.address.toLowerCase() ? (
          <StopCopyButton />
        ) : (
          <button
            onClick={() => onCopy({ targetWallet: trader.address })}
            className={`w-full py-4 font-bold transition-colors text-sm rounded tracking-wider ${
              activeCopyTarget
                ? "bg-amber text-bg hover:bg-amber/85 shadow-[0_0_20px_rgba(255,176,0,0.3)] hover:shadow-[0_0_30px_rgba(255,176,0,0.5)]"
                : "bg-green text-bg hover:bg-green/85 shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]"
            }`}
          >
            {activeCopyTarget ? "> SWITCH TO THIS TRADER _" : "> COPY THIS TRADER _"}
          </button>
        )}
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

        {/* Recent Trades */}
        <div className="text-text-dim text-xs mb-2 mt-4">
          {">"} RECENT TRADES {fills ? `[${fills.length}]` : ""}
        </div>

        {fillsLoading && (
          <div className="text-green text-xs py-4">Loading fills...</div>
        )}

        {fillsError && (
          <div className="text-red text-xs py-4">ERR: {(fillsError as Error).message}</div>
        )}

        {fills && fills.length === 0 && (
          <div className="text-text-dim text-xs py-4">No recent trades</div>
        )}

        {fills && fills.length > 0 && (
          <div className="border border-border/50 rounded overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[4rem_3.5rem_3.5rem_3.5rem_4.5rem_4rem_3rem] gap-1 px-2 py-1.5 text-[10px] text-text-dim border-b border-border/50 bg-bg/50">
              <div>TIME</div>
              <div>COIN</div>
              <div>DIR</div>
              <div>SIZE</div>
              <div>PRICE</div>
              <div>PNL</div>
              <div>FEE</div>
            </div>
            {fills.map((fill, i) => {
              const isBuy = fill.side === "B";
              const closedPnl = parseFloat(fill.closedPnl);
              const isClose = fill.dir.startsWith("Close");
              const dirAbbr = fill.dir
                .replace("Open ", "O/")
                .replace("Close ", "C/");
              const fee = parseFloat(fill.fee);

              return (
                <div
                  key={fill.hash + i}
                  className={`grid grid-cols-[4rem_3.5rem_3.5rem_3.5rem_4.5rem_4rem_3rem] gap-1 px-2 py-1 text-[10px] ${i % 2 === 0 ? "bg-bg/30" : "bg-bg-secondary/50"}`}
                >
                  <div className="text-text-dim tabular-nums truncate">{formatTimeAgo(fill.time)}</div>
                  <div className="text-amber tabular-nums">{fill.coin}</div>
                  <div className={isBuy ? "text-green" : "text-red"}>{dirAbbr}</div>
                  <div className="text-text tabular-nums">{parseFloat(fill.sz).toFixed(4)}</div>
                  <div className="text-text tabular-nums">${parseFloat(fill.px).toFixed(2)}</div>
                  <div className={`tabular-nums ${isClose ? (closedPnl >= 0 ? "text-green" : "text-red") : "text-text-dim"}`}>
                    {isClose ? formatPnl(closedPnl) : "—"}
                  </div>
                  <div className="text-text-dim tabular-nums">${fee.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
