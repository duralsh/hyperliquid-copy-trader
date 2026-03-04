import type { TraderDetail, TraderPosition, TraderFill } from "../../../shared/types.js";
import { hlInfoRequest, ACCOUNT_DEXES, fetchClearinghouseForDex, extractPositions } from "./hlClient.js";
import { TTLMapCache } from "./cache.js";

const FILLS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_RECENT_FILLS = 100;

const cache = new TTLMapCache<string, TraderDetail>(10_000); // 10s
const fillsCache = new TTLMapCache<string, TraderFill[]>(10_000);

export async function fetchTraderDetail(address: string): Promise<TraderDetail> {
  const cached = cache.get(address);
  if (cached) return cached;

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

  cache.set(address, detail);
  return detail;
}

export async function fetchTraderFills(address: string): Promise<TraderFill[]> {
  const cachedFills = fillsCache.get(address);
  if (cachedFills) return cachedFills;

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

  fillsCache.set(address, fills);
  return fills;
}
