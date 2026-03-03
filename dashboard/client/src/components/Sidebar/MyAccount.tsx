import { useMyAccount } from "../../hooks/useMyAccount.js";
import { formatUSD, formatPnl, shortenAddress } from "../../utils/format.js";

export function MyAccount() {
  const { data, isLoading, error } = useMyAccount();

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 py-4 space-y-4">
        {isLoading && (
          <div className="text-green text-xs py-8 text-center">
            <span className="cursor-blink">_</span> loading...
          </div>
        )}

        {error && (
          <div className="text-red text-xs py-4">
            ERR: {(error as Error).message}
          </div>
        )}

        {data && (
          <>
            {/* Wallet address */}
            <div className="flex items-center justify-between">
              <span className="text-text-dim text-xs uppercase tracking-wider">Wallet</span>
              <span className="text-amber text-xs">{shortenAddress(data.address)}</span>
            </div>

            <div className="border-t border-border/30" />

            {/* Account Value — prominent */}
            <div className="flex items-center justify-between">
              <span className="text-text-dim text-xs uppercase tracking-wider">Account Value</span>
              <span className="text-green text-lg tabular-nums font-bold">
                {formatUSD(parseFloat(data.accountValue))}
              </span>
            </div>

            {/* Unrealized PNL */}
            <div className="flex items-center justify-between">
              <span className="text-text-dim text-xs uppercase tracking-wider">Unrealized PNL</span>
              <span className={`text-base tabular-nums font-bold ${data.totalUnrealizedPnl >= 0 ? "text-green" : "text-red"}`}>
                {formatPnl(data.totalUnrealizedPnl)}
              </span>
            </div>

            {/* Margin Used */}
            <div className="flex items-center justify-between">
              <span className="text-text-dim text-xs uppercase tracking-wider">Margin Used</span>
              <span className="text-amber text-sm tabular-nums">
                {formatUSD(parseFloat(data.totalMarginUsed))}
              </span>
            </div>

            {/* Available */}
            <div className="flex items-center justify-between">
              <span className="text-text-dim text-xs uppercase tracking-wider">Available</span>
              <span className="text-text text-sm tabular-nums">
                {formatUSD(parseFloat(data.totalRawUsd))}
              </span>
            </div>

            {/* Positions */}
            <div className="border-t border-border/30 pt-3">
              <div className="text-text-dim text-xs uppercase tracking-wider mb-3">
                Positions ({data.positions.length})
              </div>

              {data.positions.length === 0 && (
                <div className="text-text-dim text-xs text-center py-3">
                  no open positions
                </div>
              )}

              {data.positions.length > 0 && (
                <div className="space-y-4">
                  {data.positions.map((pos) => {
                    const size = parseFloat(pos.szi);
                    const isLong = size > 0;
                    const pnl = parseFloat(pos.unrealizedPnl);
                    return (
                      <div key={pos.coin}>
                        {/* Line 1: Coin + direction + leverage + PNL */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-amber font-bold text-sm">{pos.coin}</span>
                            <span className={`text-xs ${isLong ? "text-green" : "text-red"}`}>
                              {isLong ? "LONG" : "SHORT"}
                            </span>
                            <span className="text-text-dim text-xs">{pos.leverage}x</span>
                          </div>
                          <span className={`text-sm tabular-nums font-bold ${pnl >= 0 ? "text-green" : "text-red"}`}>
                            {formatPnl(pnl)}
                          </span>
                        </div>
                        {/* Line 2: Size + Entry (indented) */}
                        <div className="flex items-center justify-between mt-0.5 pl-4 text-xs text-text-dim">
                          <span className="tabular-nums">{Math.abs(size).toFixed(4)}</span>
                          <span className="tabular-nums">@ ${parseFloat(pos.entryPx).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
