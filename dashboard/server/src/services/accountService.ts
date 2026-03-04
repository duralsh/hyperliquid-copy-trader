import type { MyAccountData, CloseAllResult, ClosePositionResult } from "../../../shared/types.js";
import { hlInfoRequest, ACCOUNT_DEXES, fetchClearinghouseForDex, extractPositions } from "./hlClient.js";
import { arenaRequest } from "./arenaClient.js";
import { TTLCache } from "./cache.js";

const cache = new TTLCache<MyAccountData>(10_000); // 10s

function getWalletAddress(): string {
  const addr = process.env.MAIN_WALLET_ADDRESS ?? "";
  if (!addr) {
    throw new Error("MAIN_WALLET_ADDRESS is not configured in environment");
  }
  return addr;
}

/**
 * Close a single open position for the given coin via the Arena API.
 */
export async function closePosition(coin: string, walletAddress?: string, arenaApiKey?: string): Promise<ClosePositionResult> {
  // Force-fetch fresh positions (bypass cache)
  cache.invalidate();
  const account = await fetchMyAccount(walletAddress);

  const pos = account.positions.find((p) => p.coin === coin);
  if (!pos) {
    return { success: false, coin, error: `No open position found for ${coin}` };
  }

  const size = parseFloat(pos.szi);
  if (size === 0) {
    return { success: false, coin, error: `Position size is zero for ${coin}` };
  }

  const isLong = size > 0;
  const positionSide = isLong ? "long" : "short";

  // Fetch current market price
  const allMids = await hlInfoRequest<Record<string, string>>({ type: "allMids" });
  const midPrice = parseFloat(allMids[coin] ?? "0");

  if (midPrice <= 0) {
    return { success: false, coin, error: "Could not determine market price" };
  }

  try {
    await arenaRequest("POST", "/agents/perp/orders/close-position", {
      provider: "HYPERLIQUID",
      symbol: coin,
      positionSide,
      size: Math.abs(size),
      currentPrice: midPrice,
      closePercent: 100,
    }, arenaApiKey);

    // Invalidate cache so next fetch reflects the closed position
    cache.invalidate();

    return {
      success: true,
      coin,
      side: positionSide,
      size: String(Math.abs(size)),
    };
  } catch (err: unknown) {
    return {
      success: false,
      coin,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Close all open positions by sending a market close for each via the Arena API.
 */
export async function closeAllPositions(walletAddress?: string, arenaApiKey?: string): Promise<CloseAllResult> {
  // Force-fetch fresh positions (bypass cache)
  cache.invalidate();
  const account = await fetchMyAccount(walletAddress);

  if (account.positions.length === 0) {
    return { closed: [], errors: [] };
  }

  const result: CloseAllResult = { closed: [], errors: [] };

  // Fetch current market prices for all position coins
  const allMids = await hlInfoRequest<Record<string, string>>({ type: "allMids" });

  // Close all positions in parallel — each is independent
  const closePromises = account.positions
    .filter((pos) => parseFloat(pos.szi) !== 0)
    .map(async (pos) => {
      const size = parseFloat(pos.szi);
      const isLong = size > 0;
      const positionSide = isLong ? "long" : "short";
      const midPrice = parseFloat(allMids[pos.coin] ?? "0");

      if (midPrice <= 0) {
        return { coin: pos.coin, error: "Could not determine market price" } as const;
      }

      try {
        await arenaRequest("POST", "/agents/perp/orders/close-position", {
          provider: "HYPERLIQUID",
          symbol: pos.coin,
          positionSide,
          size: Math.abs(size),
          currentPrice: midPrice,
          closePercent: 100,
        }, arenaApiKey);
        return { coin: pos.coin, side: positionSide, size: String(Math.abs(size)) } as const;
      } catch (err: unknown) {
        return { coin: pos.coin, error: err instanceof Error ? err.message : "Unknown error" } as const;
      }
    });

  const outcomes = await Promise.all(closePromises);

  for (const outcome of outcomes) {
    if ("error" in outcome) {
      result.errors.push({ coin: outcome.coin, error: outcome.error });
    } else {
      result.closed.push({ coin: outcome.coin, side: outcome.side, size: outcome.size });
    }
  }

  // Invalidate cache so next fetch reflects closed positions
  cache.invalidate();

  return result;
}

export async function fetchMyAccount(walletAddress?: string): Promise<MyAccountData> {
  const address = walletAddress ?? getWalletAddress();

  const cached = cache.get();
  if (cached) return cached;

  // Fetch all DEXes in parallel
  const results = await Promise.all(
    ACCOUNT_DEXES.map((dex) => fetchClearinghouseForDex(address, dex)),
  );

  // Aggregate positions and numeric totals across all DEXes
  let totalAccountValue = 0;
  let totalMarginUsed = 0;
  let totalNtlPos = 0;
  let totalRawUsd = 0;
  const positions = [];

  for (const state of results) {
    if (!state) continue;
    const ms = state.marginSummary ?? {};
    totalAccountValue += parseFloat(ms.accountValue ?? "0") || 0;
    totalMarginUsed += parseFloat(ms.totalMarginUsed ?? "0") || 0;
    totalNtlPos += parseFloat(ms.totalNtlPos ?? "0") || 0;
    totalRawUsd += parseFloat(ms.totalRawUsd ?? "0") || 0;
    positions.push(...extractPositions(state));
  }

  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + (parseFloat(p.unrealizedPnl) || 0), 0,
  );

  const data: MyAccountData = {
    address,
    accountValue: totalAccountValue.toFixed(6),
    totalMarginUsed: totalMarginUsed.toFixed(6),
    totalNtlPos: totalNtlPos.toFixed(6),
    totalRawUsd: totalRawUsd.toFixed(6),
    positions,
    totalUnrealizedPnl,
  };

  cache.set(data);
  return data;
}
