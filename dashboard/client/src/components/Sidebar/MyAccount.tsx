import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMyAccount } from "../../hooks/useMyAccount.js";
import { formatUSD, formatPnl, formatTimeAgo, shortenAddress } from "../../utils/format.js";
import { CopyButton } from "../CopyButton.js";
import { closeAllPositions, closePosition, fetchTraderFills } from "../../services/api.js";
import { depositToHL, withdrawFromHL } from "../../services/api.js";
import { useWalletBalances } from "../../hooks/useWalletBalances.js";
import type { BotStatus } from "../../../../shared/types.js";

type CloseButtonState = "idle" | "confirm" | "closing" | "closed" | "error";
type PositionCloseState = "idle" | "confirm" | "closing" | "error";

function PositionCloseButton({ coin, onSuccess }: { coin: string; onSuccess: () => void }) {
  const [state, setState] = useState<PositionCloseState>("idle");
  const [errMsg, setErrMsg] = useState("");
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state === "confirm") {
      confirmTimer.current = setTimeout(() => setState("idle"), 3000);
    }
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
  }, [state]);

  const mutation = useMutation({
    mutationFn: () => closePosition(coin),
    onSuccess: (result) => {
      if (!result.success) {
        setErrMsg(result.error ?? "Failed");
        setState("error");
        errorTimer.current = setTimeout(() => setState("idle"), 3000);
      } else {
        setState("idle");
        onSuccess();
      }
    },
    onError: (err: Error) => {
      setErrMsg(err.message);
      setState("error");
      errorTimer.current = setTimeout(() => setState("idle"), 3000);
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === "idle") {
      setState("confirm");
    } else if (state === "confirm") {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setState("closing");
      mutation.mutate();
    }
  };

  if (state === "closing") {
    return (
      <span className="text-amber text-xs font-bold whitespace-nowrap cursor-not-allowed ml-1 shrink-0">
        CLOSING...
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="text-red text-xs font-bold whitespace-nowrap ml-1 shrink-0" title={errMsg}>
        ERR
      </span>
    );
  }

  if (state === "confirm") {
    return (
      <button
        onClick={handleClick}
        className="text-red text-xs font-bold whitespace-nowrap ml-1 shrink-0 animate-pulse cursor-pointer bg-transparent border-none p-0 hover:underline"
      >
        CLOSE?
      </button>
    );
  }

  // idle — only visible on group hover
  return (
    <button
      onClick={handleClick}
      className="text-red/0 group-hover:text-red text-xs font-bold whitespace-nowrap ml-1 shrink-0 cursor-pointer bg-transparent border-none p-0 transition-colors duration-150 hover:underline"
    >
      CLOSE
    </button>
  );
}

type WalletAction = "idle" | "deposit" | "withdraw";
type ActionStatus = "idle" | "confirming" | "submitting" | "success" | "error";

function ArbWalletSection({ hlAvailable }: { hlAvailable: number }) {
  const { data: walletData, isLoading: walletLoading } = useWalletBalances();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<WalletAction>("idle");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [resultMsg, setResultMsg] = useState("");
  const [txHash, setTxHash] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
  }, []);

  const reset = useCallback(() => {
    setMode("idle");
    setAmount("");
    setStatus("idle");
    setResultMsg("");
    setTxHash("");
  }, []);

  const handleAction = async () => {
    if (status === "idle") {
      setStatus("confirming");
      return;
    }
    if (status !== "confirming") return;

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setResultMsg("Invalid amount");
      setStatus("error");
      resetTimer.current = setTimeout(reset, 3000);
      return;
    }
    if (mode === "deposit" && num < 5) {
      setResultMsg("Min 5 USDC");
      setStatus("error");
      resetTimer.current = setTimeout(reset, 3000);
      return;
    }

    setStatus("submitting");
    try {
      if (mode === "deposit") {
        const result = await depositToHL(num);
        setTxHash(result.txHash);
        setResultMsg("Deposited");
        setStatus("success");
      } else {
        await withdrawFromHL(num);
        setResultMsg("Withdrawn");
        setStatus("success");
      }
      queryClient.invalidateQueries({ queryKey: ["walletBalances"] });
      queryClient.invalidateQueries({ queryKey: ["myAccount"] });
      resetTimer.current = setTimeout(reset, 5000);
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "Failed");
      setStatus("error");
      resetTimer.current = setTimeout(reset, 4000);
    }
  };

  return (
    <div className="space-y-2">
      {/* Balances */}
      <div className="flex items-center justify-between">
        <span className="text-text-dim text-xs">ETH</span>
        <span className="text-text text-xs tabular-nums">
          {walletLoading ? "..." : walletData ? walletData.ethBalance.toFixed(6) : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-text-dim text-xs">USDC</span>
        <span className="text-text text-xs tabular-nums">
          {walletLoading ? "..." : walletData ? walletData.usdcBalance.toFixed(2) : "—"}
        </span>
      </div>

      {/* Action buttons or form */}
      {mode === "idle" ? (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setMode("deposit")}
            className="flex-1 py-1 px-2 text-xs font-bold uppercase tracking-wider border border-green/40 text-green rounded hover:border-green hover:bg-green/10 transition-all duration-200 cursor-pointer bg-transparent"
          >
            Deposit
          </button>
          <button
            onClick={() => setMode("withdraw")}
            className="flex-1 py-1 px-2 text-xs font-bold uppercase tracking-wider border border-amber/40 text-amber rounded hover:border-amber hover:bg-amber/10 transition-all duration-200 cursor-pointer bg-transparent"
          >
            Withdraw
          </button>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={mode === "deposit" ? 5 : 1}
              step="0.01"
              placeholder={mode === "deposit" ? "Min 5 USDC" : "Amount USDC"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={status === "submitting" || status === "success"}
              className="flex-1 min-w-0 bg-transparent border border-border/50 rounded px-2 py-1 text-xs text-text tabular-nums outline-none focus:border-green/60"
            />
            <button
              onClick={() => {
                if (!walletData) return;
                if (mode === "deposit") {
                  setAmount(walletData.usdcBalance.toFixed(2));
                } else {
                  setAmount(hlAvailable.toFixed(2));
                }
              }}
              disabled={status === "submitting" || status === "success"}
              className="py-1 px-1.5 text-xs font-bold uppercase tracking-wider text-text-dim border border-border/30 rounded hover:border-green hover:text-green transition-all duration-200 cursor-pointer bg-transparent shrink-0"
            >
              Max
            </button>
            <button
              onClick={handleAction}
              disabled={status === "submitting" || status === "success"}
              className={`py-1 px-3 text-xs font-bold uppercase tracking-wider border rounded transition-all duration-200 cursor-pointer bg-transparent ${
                status === "confirming"
                  ? "border-red text-red animate-pulse"
                  : status === "submitting"
                  ? "border-amber/40 text-amber opacity-70 cursor-not-allowed"
                  : mode === "deposit"
                  ? "border-green/40 text-green hover:border-green"
                  : "border-amber/40 text-amber hover:border-amber"
              }`}
            >
              {status === "confirming" ? "Sure?" : status === "submitting" ? "..." : "OK"}
            </button>
            <button
              onClick={reset}
              disabled={status === "submitting"}
              className="py-1 px-2 text-xs text-text-dim border border-border/30 rounded hover:border-border cursor-pointer bg-transparent"
            >
              ✕
            </button>
          </div>

          {/* Result messages */}
          {status === "success" && (
            <div className="text-green text-xs">
              {resultMsg}
              {txHash && (
                <>
                  {" — "}
                  <a
                    href={`https://arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber underline hover:text-green"
                  >
                    arbiscan
                  </a>
                </>
              )}
            </div>
          )}
          {status === "error" && (
            <div className="text-red text-xs">{resultMsg}</div>
          )}
        </div>
      )}
    </div>
  );
}

function TradingHistory({ address }: { address: string }) {
  const { data: fills, isLoading, error } = useQuery({
    queryKey: ["myFills", address],
    queryFn: () => fetchTraderFills(address),
    refetchInterval: 30_000,
  });

  return (
    <div className="border-t border-border/30 pt-3">
      <div className="text-text-dim text-xs uppercase tracking-wider mb-3">
        Recent Trades {fills ? `(${fills.length})` : ""}
      </div>

      {isLoading && (
        <div className="text-green text-xs text-center py-3">
          loading<span className="cursor-blink">_</span>
        </div>
      )}

      {error && (
        <div className="text-red text-xs py-2">
          ERR: {(error as Error).message}
        </div>
      )}

      {fills && fills.length === 0 && (
        <div className="text-text-dim text-xs text-center py-3">
          no recent trades
        </div>
      )}

      {fills && fills.length > 0 && (
        <div className="space-y-1">
          {fills.map((fill, i) => {
            const isBuy = fill.side === "B";
            const closedPnl = parseFloat(fill.closedPnl);
            const isClose = fill.dir.startsWith("Close");
            const dirLabel = fill.dir
              .replace("Open ", "O/")
              .replace("Close ", "C/");

            return (
              <div
                key={fill.hash + i}
                className="flex items-center justify-between py-1 text-xs group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-amber font-bold">{fill.coin}</span>
                  <span className={isBuy ? "text-green" : "text-red"}>
                    {dirLabel}
                  </span>
                  <span className="text-text-dim tabular-nums">
                    {parseFloat(fill.sz).toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isClose ? (
                    <span className={`tabular-nums font-bold ${closedPnl >= 0 ? "text-green" : "text-red"}`}>
                      {formatPnl(closedPnl)}
                    </span>
                  ) : (
                    <span className="text-text-dim tabular-nums">
                      ${parseFloat(fill.px).toFixed(2)}
                    </span>
                  )}
                  <span className="text-text-dim/60 tabular-nums text-[10px]">
                    {formatTimeAgo(fill.time)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MyAccountProps {
  botStatus: BotStatus | null;
  onViewTrader: (address: string) => void;
  isSwitching?: boolean;
}

export function MyAccount({ botStatus, onViewTrader, isSwitching }: MyAccountProps) {
  const { data, isLoading, error } = useMyAccount();
  const queryClient = useQueryClient();

  const [btnState, setBtnState] = useState<CloseButtonState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (confirmTimer.current) { clearTimeout(confirmTimer.current); confirmTimer.current = null; }
    if (closedTimer.current) { clearTimeout(closedTimer.current); closedTimer.current = null; }
  }, []);

  // Reset confirm state after 3 seconds
  useEffect(() => {
    if (btnState === "confirm") {
      confirmTimer.current = setTimeout(() => setBtnState("idle"), 3000);
    }
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
  }, [btnState]);

  // Reset closed state after 2 seconds
  useEffect(() => {
    if (btnState === "closed") {
      closedTimer.current = setTimeout(() => setBtnState("idle"), 2000);
    }
    return () => { if (closedTimer.current) clearTimeout(closedTimer.current); };
  }, [btnState]);

  const mutation = useMutation({
    mutationFn: closeAllPositions,
    onSuccess: (result) => {
      clearTimers();
      if (result.errors.length > 0 && result.closed.length === 0) {
        setErrorMsg(result.errors.map((e) => `${e.coin}: ${e.error}`).join("; "));
        setBtnState("error");
        setTimeout(() => setBtnState("idle"), 4000);
      } else {
        setBtnState("closed");
        queryClient.invalidateQueries({ queryKey: ["myAccount"] });
      }
    },
    onError: (err: Error) => {
      clearTimers();
      setErrorMsg(err.message);
      setBtnState("error");
      setTimeout(() => setBtnState("idle"), 4000);
    },
  });

  const handleClick = () => {
    if (btnState === "idle") {
      setBtnState("confirm");
    } else if (btnState === "confirm") {
      clearTimers();
      setBtnState("closing");
      mutation.mutate();
    }
  };

  const btnLabel = (): string => {
    switch (btnState) {
      case "idle": return "CLOSE ALL POSITIONS";
      case "confirm": return "CONFIRM CLOSE ALL?";
      case "closing": return "CLOSING...";
      case "closed": return "CLOSED";
      case "error": return "ERROR";
    }
  };

  const btnClasses = (): string => {
    const base = "w-full py-2 px-3 text-xs font-bold uppercase tracking-wider border rounded transition-all duration-200 cursor-pointer";
    switch (btnState) {
      case "idle":
        return `${base} border-red/40 text-red hover:border-red hover:bg-red/10`;
      case "confirm":
        return `${base} border-red text-red bg-red/10 animate-pulse`;
      case "closing":
        return `${base} border-amber/40 text-amber opacity-70 cursor-not-allowed`;
      case "closed":
        return `${base} border-green/40 text-green`;
      case "error":
        return `${base} border-red text-red`;
    }
  };

  const hasPositions = data && data.positions.length > 0;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 py-4 space-y-4">
        {isLoading && (
          <div className="text-green text-xs py-8 text-center">
            loading<span className="cursor-blink">_</span>
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
              <span className="text-amber text-xs flex items-center gap-1">
                {shortenAddress(data.address)}
                <CopyButton text={data.address} />
              </span>
            </div>

            {/* Currently following */}
            <div className="flex items-center justify-between">
              <span className="text-text-dim text-xs uppercase tracking-wider">Following</span>
              {isSwitching ? (
                <span className="text-amber text-xs flex items-center gap-1 animate-pulse">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber shrink-0" />
                  switching...
                </span>
              ) : botStatus?.running && botStatus.targetWallet ? (
                <button
                  onClick={() => onViewTrader(botStatus.targetWallet!)}
                  className="text-green text-xs flex items-center gap-1 hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                  {shortenAddress(botStatus.targetWallet)}
                  <CopyButton text={botStatus.targetWallet} />
                </button>
              ) : (
                <span className="text-text-dim text-xs">inactive</span>
              )}
            </div>

            {/* ARB WALLET */}
            <div className="border-t border-border/30 pt-3">
              <div className="text-text-dim text-xs uppercase tracking-wider mb-2">
                Arb Wallet
              </div>
              <ArbWalletSection hlAvailable={parseFloat(data.totalRawUsd)} />
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
                      <div key={pos.coin} className="group">
                        {/* Line 1: Coin + direction + leverage + PNL + Close */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-amber font-bold text-sm">{pos.coin}</span>
                            <span className={`text-xs ${isLong ? "text-green" : "text-red"}`}>
                              {isLong ? "LONG" : "SHORT"}
                            </span>
                            <span className="text-text-dim text-xs">{pos.leverage}x</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-sm tabular-nums font-bold ${pnl >= 0 ? "text-green" : "text-red"}`}>
                              {formatPnl(pnl)}
                            </span>
                            <PositionCloseButton
                              coin={pos.coin}
                              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["myAccount"] })}
                            />
                          </div>
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

            {/* Close All Positions button */}
            {hasPositions && (
              <div className="border-t border-border/30 pt-3">
                <button
                  onClick={handleClick}
                  disabled={btnState === "closing" || btnState === "closed"}
                  className={btnClasses()}
                >
                  {btnLabel()}
                </button>
                {btnState === "error" && errorMsg && (
                  <div className="text-red text-xs mt-2 break-words">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}

            {/* Trading History */}
            <TradingHistory address={data.address} />
          </>
        )}
      </div>
    </div>
  );
}
