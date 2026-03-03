import type { TraderDetail, TraderPosition, TraderFill } from "../../../shared/types.js";

const HL_INFO_URL = "https://api-ui.hyperliquid.xyz/info";
const CACHE_TTL = 10_000; // 10s

/** DEXes to query — main perps clearinghouse + xyz (HIP-3) DEX. */
const DEXES: (string | undefined)[] = [undefined, "xyz"];

const cache = new Map<string, { data: TraderDetail; fetchedAt: number }>();
const fillsCache = new Map<string, { data: TraderFill[]; fetchedAt: number }>();

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
  // API returns null for DEXes the user never interacted with
  if (!json || typeof json !== "object") return null;
  return json as ClearinghouseState;
}

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
    DEXES.map((dex) => fetchClearinghouseForDex(address, dex)),
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

  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "userFills", user: address }),
  });

  if (!res.ok) throw new Error(`User fills fetch failed: ${res.status}`);

  const raw = (await res.json()) as {
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
  }[];

  const fills: TraderFill[] = raw.slice(-100).reverse().map((f) => ({
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
