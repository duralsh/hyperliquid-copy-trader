import type { MyAccountData, MyAccountPosition } from "../../../shared/types.js";

const HL_INFO_URL = "https://api-ui.hyperliquid.xyz/info";
const CACHE_TTL = 10_000; // 10s

let cache: { data: MyAccountData; fetchedAt: number } | null = null;

/** Read lazily so dotenv has time to load (ESM hoists imports before dotenv.config()). */
function getArenaBaseUrl(): string {
  return (process.env.ARENA_BASE_URL ?? "https://api.starsarena.com").replace(/\/$/, "");
}

function getWalletAddress(): string {
  const addr = process.env.MAIN_WALLET_ADDRESS ?? "";
  if (!addr) {
    throw new Error("MAIN_WALLET_ADDRESS is not configured in environment");
  }
  return addr;
}

function getArenaApiKey(): string {
  const key = process.env.ARENA_API_KEY ?? "";
  if (!key) {
    throw new Error("ARENA_API_KEY is not configured in environment");
  }
  return key;
}

export interface CloseAllResult {
  closed: { coin: string; side: string; size: string }[];
  errors: { coin: string; error: string }[];
}

export interface ClosePositionResult {
  success: boolean;
  coin: string;
  side?: string;
  size?: string;
  error?: string;
}

/**
 * Close a single open position for the given coin via the Arena API.
 */
export async function closePosition(coin: string): Promise<ClosePositionResult> {
  // Force-fetch fresh positions (bypass cache)
  cache = null;
  const account = await fetchMyAccount();

  const pos = account.positions.find((p) => p.coin === coin);
  if (!pos) {
    return { success: false, coin, error: `No open position found for ${coin}` };
  }

  const size = parseFloat(pos.szi);
  if (size === 0) {
    return { success: false, coin, error: `Position size is zero for ${coin}` };
  }

  const apiKey = getArenaApiKey();
  const isLong = size > 0;
  const positionSide = isLong ? "long" : "short";

  // Fetch current market price
  const midsRes = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });

  if (!midsRes.ok) {
    throw new Error(`Failed to fetch market prices: ${midsRes.status}`);
  }

  const allMids = (await midsRes.json()) as Record<string, string>;
  const midPrice = parseFloat(allMids[coin] ?? "0");

  if (midPrice <= 0) {
    return { success: false, coin, error: "Could not determine market price" };
  }

  const body = {
    provider: "HYPERLIQUID",
    symbol: coin,
    positionSide,
    size: Math.abs(size),
    currentPrice: midPrice,
    closePercent: 100,
  };

  try {
    const res = await fetch(`${getArenaBaseUrl()}/agents/perp/orders/close-position`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      return { success: false, coin, error: `API ${res.status}: ${errBody}` };
    }

    // Invalidate cache so next fetch reflects the closed position
    cache = null;

    return {
      success: true,
      coin,
      side: positionSide,
      size: String(Math.abs(size)),
    };
  } catch (err) {
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
export async function closeAllPositions(): Promise<CloseAllResult> {
  // Force-fetch fresh positions (bypass cache)
  cache = null;
  const account = await fetchMyAccount();

  if (account.positions.length === 0) {
    return { closed: [], errors: [] };
  }

  const apiKey = getArenaApiKey();
  const result: CloseAllResult = { closed: [], errors: [] };

  // Fetch current market prices for all position coins
  const midsRes = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });

  if (!midsRes.ok) {
    throw new Error(`Failed to fetch market prices: ${midsRes.status}`);
  }

  const allMids = (await midsRes.json()) as Record<string, string>;

  for (const pos of account.positions) {
    const size = parseFloat(pos.szi);
    if (size === 0) continue;

    const isLong = size > 0;
    const positionSide = isLong ? "long" : "short";
    const midPrice = parseFloat(allMids[pos.coin] ?? "0");

    if (midPrice <= 0) {
      result.errors.push({ coin: pos.coin, error: "Could not determine market price" });
      continue;
    }

    const body = {
      provider: "HYPERLIQUID",
      symbol: pos.coin,
      positionSide,
      size: Math.abs(size),
      currentPrice: midPrice,
      closePercent: 100,
    };

    try {
      const res = await fetch(`${getArenaBaseUrl()}/agents/perp/orders/close-position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        result.errors.push({ coin: pos.coin, error: `API ${res.status}: ${errBody}` });
        continue;
      }

      result.closed.push({
        coin: pos.coin,
        side: positionSide,
        size: String(Math.abs(size)),
      });
    } catch (err) {
      result.errors.push({
        coin: pos.coin,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Invalidate cache so next fetch reflects closed positions
  cache = null;

  return result;
}

/** DEXes to query — main perps clearinghouse + xyz (HIP-3) DEX. */
const ACCOUNT_DEXES: (string | undefined)[] = [undefined, "xyz"];

interface ClearinghouseState {
  marginSummary?: Record<string, string>;
  assetPositions?: { position?: Record<string, unknown> }[];
}

async function fetchClearinghouseForDex(
  address: string,
  dex?: string,
): Promise<ClearinghouseState | null> {
  const body: Record<string, unknown> = { type: "clearinghouseState", user: address };
  if (dex !== undefined) body.dex = dex;

  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;

  const json = await res.json();
  if (!json || typeof json !== "object") return null;
  return json as ClearinghouseState;
}

export async function fetchMyAccount(): Promise<MyAccountData> {
  const address = getWalletAddress();

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  // Fetch all DEXes in parallel
  const results = await Promise.all(
    ACCOUNT_DEXES.map((dex) => fetchClearinghouseForDex(address, dex)),
  );

  // Aggregate positions and numeric totals across all DEXes
  let totalAccountValue = 0;
  let totalMarginUsed = 0;
  let totalNtlPos = 0;
  let totalRawUsd = 0;
  let totalUnrealizedPnl = 0;
  const positions: MyAccountPosition[] = [];

  for (const state of results) {
    if (!state) continue;
    const ms = state.marginSummary ?? {};
    totalAccountValue += parseFloat(ms.accountValue ?? "0") || 0;
    totalMarginUsed += parseFloat(ms.totalMarginUsed ?? "0") || 0;
    totalNtlPos += parseFloat(ms.totalNtlPos ?? "0") || 0;
    totalRawUsd += parseFloat(ms.totalRawUsd ?? "0") || 0;

    for (const ap of state.assetPositions ?? []) {
      const p = ap.position;
      if (!p || parseFloat(String(p.szi)) === 0) continue;
      const lev = p.leverage as { value?: string | number } | undefined;
      const unrealizedPnl = String(p.unrealizedPnl ?? "0");
      totalUnrealizedPnl += parseFloat(unrealizedPnl) || 0;
      positions.push({
        coin: String(p.coin),
        szi: String(p.szi),
        entryPx: String(p.entryPx ?? "0"),
        leverage: String(lev?.value ?? "1"),
        liquidationPx: String(p.liquidationPx ?? "0"),
        marginUsed: String(p.marginUsed ?? "0"),
        returnOnEquity: String(p.returnOnEquity ?? "0"),
        unrealizedPnl,
      });
    }
  }

  const data: MyAccountData = {
    address,
    accountValue: totalAccountValue.toFixed(6),
    totalMarginUsed: totalMarginUsed.toFixed(6),
    totalNtlPos: totalNtlPos.toFixed(6),
    totalRawUsd: totalRawUsd.toFixed(6),
    positions,
    totalUnrealizedPnl,
  };

  cache = { data, fetchedAt: Date.now() };
  return data;
}
