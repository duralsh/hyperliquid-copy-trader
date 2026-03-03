import type { MyAccountData, MyAccountPosition } from "../../../shared/types.js";

const HL_INFO_URL = "https://api-ui.hyperliquid.xyz/info";
const CACHE_TTL = 10_000; // 10s

let cache: { data: MyAccountData; fetchedAt: number } | null = null;

function getWalletAddress(): string {
  const addr = process.env.MAIN_WALLET_ADDRESS ?? "";
  if (!addr) {
    throw new Error("MAIN_WALLET_ADDRESS is not configured in environment");
  }
  return addr;
}

export async function fetchMyAccount(): Promise<MyAccountData> {
  const address = getWalletAddress();

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: address }),
  });

  if (!res.ok) {
    throw new Error(`Clearinghouse fetch failed: ${res.status}`);
  }

  const state = (await res.json()) as {
    marginSummary?: Record<string, string>;
    assetPositions?: { position?: Record<string, unknown> }[];
  };

  const ms = state.marginSummary ?? {};
  const positions: MyAccountPosition[] = [];
  let totalUnrealizedPnl = 0;

  for (const ap of state.assetPositions ?? []) {
    const p = ap.position;
    if (!p || parseFloat(String(p.szi)) === 0) continue;
    const lev = p.leverage as { value?: string } | undefined;
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

  const data: MyAccountData = {
    address,
    accountValue: ms.accountValue ?? "0",
    totalMarginUsed: ms.totalMarginUsed ?? "0",
    totalNtlPos: ms.totalNtlPos ?? "0",
    totalRawUsd: ms.totalRawUsd ?? "0",
    positions,
    totalUnrealizedPnl,
  };

  cache = { data, fetchedAt: Date.now() };
  return data;
}
