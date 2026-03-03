import type { TraderDetail, TraderPosition } from "../../../shared/types.js";

const HL_INFO_URL = "https://api-ui.hyperliquid.xyz/info";
const CACHE_TTL = 10_000; // 10s

const cache = new Map<string, { data: TraderDetail; fetchedAt: number }>();

export async function fetchTraderDetail(address: string): Promise<TraderDetail> {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: address }),
  });

  if (!res.ok) throw new Error(`Clearinghouse fetch failed: ${res.status}`);

  const state = (await res.json()) as {
    marginSummary?: Record<string, string>;
    assetPositions?: { position?: Record<string, unknown> }[];
  };

  const ms = state.marginSummary ?? {};
  const positions: TraderPosition[] = [];

  for (const ap of state.assetPositions ?? []) {
    const p = ap.position;
    if (!p || parseFloat(String(p.szi)) === 0) continue;
    const lev = p.leverage as { value?: string } | undefined;
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

  const detail: TraderDetail = {
    address,
    accountValue: ms.accountValue ?? "0",
    totalMarginUsed: ms.totalMarginUsed ?? "0",
    totalNtlPos: ms.totalNtlPos ?? "0",
    positions,
  };

  cache.set(address, { data: detail, fetchedAt: Date.now() });
  return detail;
}
