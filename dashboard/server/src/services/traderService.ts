import type { TraderDetail, TraderPosition, TraderFill } from "../../../shared/types.js";
import { hlInfoRequest, ACCOUNT_DEXES, fetchClearinghouseForDex, type ClearinghouseState } from "./hlClient.js";

const CACHE_TTL = 10_000; // 10s
const FILLS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_RECENT_FILLS = 100;

const cache = new Map<string, { data: TraderDetail; fetchedAt: number }>();
const fillsCache = new Map<string, { data: TraderFill[]; fetchedAt: number }>();

function extractPositions(state: ClearinghouseState): TraderPosition[] {
  const positions: TraderPosition[] = [];
  for (const ap of state.assetPositions ?? []) {
    const p = ap.position;
    if (!p || parseFloat(String(p.szi)) === 0) continue;
    const lev = p.leverage as { value?: string | number } | undefined;
    positions.push({
      coin: String(p.coin),
      szi: String(p.szi),
      entryPx: String(p.entryPx ?? "0"),
      leverage: String(lev?.value ?? "1"),
      liquidationPx: String(p.liquidationPx ?? "0"),
      marginUsed: String(p.marginUsed ?? "0"),
      returnOnEquity: String(p.returnOnEquity ?? "0"),
      unrealizedPnl: String(p.unrealizedPnl ?? "0"),
    });
  }
  return positions;
}

export async function fetchTraderDetail(address: string): Promise<TraderDetail> {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  // Fetch all DEXes in parallel
  const results = await Promise.all(
    ACCOUNT_DEXES.map((dex) => fetchClearinghouseForDex(address, dex)),
  );

  // Aggregate positions and numeric totals across all DEXes
  let totalAccountValue = 0;
  let totalMarginUsed = 0;
  let totalNtlPos = 0;
  const allPositions: TraderPosition[] = [];

  for (const state of results) {
    if (!state) continue;
    const ms = state.marginSummary ?? {};
    totalAccountValue += parseFloat(ms.accountValue ?? "0") || 0;
    totalMarginUsed += parseFloat(ms.totalMarginUsed ?? "0") || 0;
    totalNtlPos += parseFloat(ms.totalNtlPos ?? "0") || 0;
    allPositions.push(...extractPositions(state));
  }

  const detail: TraderDetail = {
    address,
    accountValue: totalAccountValue.toFixed(6),
    totalMarginUsed: totalMarginUsed.toFixed(6),
    totalNtlPos: totalNtlPos.toFixed(6),
    positions: allPositions,
  };

  cache.set(address, { data: detail, fetchedAt: Date.now() });
  return detail;
}

export async function fetchTraderFills(address: string): Promise<TraderFill[]> {
  const cached = fillsCache.get(address);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  // userFillsByTime returns recent fills; userFills caps at 2000 oldest
  const startTime = Date.now() - FILLS_LOOKBACK_MS;
  const raw = await hlInfoRequest<{
    coin: string;
    px: string;
    sz: string;
    side: string;
    time: number;
    dir: string;
    closedPnl: string;
    hash: string;
    fee: string;
    crossed: boolean;
  }[]>({ type: "userFillsByTime", user: address, startTime });

  const fills: TraderFill[] = raw.slice(-MAX_RECENT_FILLS).reverse().map((f) => ({
    coin: f.coin,
    px: f.px,
    sz: f.sz,
    side: f.side as "A" | "B",
    time: f.time,
    dir: f.dir as TraderFill["dir"],
    closedPnl: f.closedPnl,
    hash: f.hash,
    fee: f.fee,
    crossed: f.crossed,
  }));

  fillsCache.set(address, { data: fills, fetchedAt: Date.now() });
  return fills;
}
