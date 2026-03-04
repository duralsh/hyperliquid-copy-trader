import type { TraderSummary, LeaderboardQuery, LeaderboardResponse, TimeWindow, SortField } from "../../../shared/types.js";
import { TTLCache } from "./cache.js";

const LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";

interface RawPerformance {
  pnl: string;
  roi: string;
  vlm: string;
}

interface RawLeaderboardRow {
  ethAddress: string;
  accountValue: string;
  displayName: string | null;
  prize: number;
  windowPerformances: [string, RawPerformance][];
}

const cache = new TTLCache<TraderSummary[]>(60_000); // 60s

function parsePerf(
  windows: [string, RawPerformance][]
): { pnl: Record<string, number>; roi: Record<string, number>; volume: Record<string, number> } {
  const pnl: Record<string, number> = {};
  const roi: Record<string, number> = {};
  const volume: Record<string, number> = {};
  for (const [key, perf] of windows) {
    pnl[key] = parseFloat(perf.pnl) || 0;
    roi[key] = parseFloat(perf.roi) || 0;
    volume[key] = parseFloat(perf.vlm) || 0;
  }
  return { pnl, roi, volume };
}

export async function fetchLeaderboard(): Promise<TraderSummary[]> {
  const cached = cache.get();
  if (cached) return cached;

  const res = await fetch(LEADERBOARD_URL);
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);

  const json = (await res.json()) as { leaderboardRows: RawLeaderboardRow[] };
  const rows = json.leaderboardRows ?? [];

  const traders: TraderSummary[] = rows.map((row, i) => {
    const { pnl, roi, volume } = parsePerf(row.windowPerformances);
    return {
      rank: i + 1,
      address: row.ethAddress,
      accountValue: parseFloat(row.accountValue) || 0,
      displayName: row.displayName,
      pnl: {
        day: pnl.day ?? 0,
        week: pnl.week ?? 0,
        month: pnl.month ?? 0,
        allTime: pnl.allTime ?? 0,
      },
      roi: {
        day: roi.day ?? 0,
        week: roi.week ?? 0,
        month: roi.month ?? 0,
        allTime: roi.allTime ?? 0,
      },
      volume: {
        day: volume.day ?? 0,
        week: volume.week ?? 0,
        month: volume.month ?? 0,
        allTime: volume.allTime ?? 0,
      },
    };
  });

  cache.set(traders);
  return traders;
}

export async function lookupTraders(addresses: string[]): Promise<TraderSummary[]> {
  const all = await fetchLeaderboard();
  const wanted = new Set(addresses.map((a) => a.toLowerCase()));
  return all.filter((t) => wanted.has(t.address.toLowerCase()));
}

export async function queryLeaderboard(query: LeaderboardQuery): Promise<LeaderboardResponse> {
  let traders = await fetchLeaderboard();
  const window: TimeWindow = query.window ?? "month";
  const sortField: SortField = query.sort ?? "pnl";
  const order = query.order ?? "desc";

  if (query.minAccountValue !== undefined) {
    traders = traders.filter((t) => t.accountValue >= query.minAccountValue!);
  }
  if (query.maxAccountValue !== undefined) {
    traders = traders.filter((t) => t.accountValue <= query.maxAccountValue!);
  }

  traders.sort((a, b) => {
    let aVal: number, bVal: number;
    if (sortField === "accountValue") {
      aVal = a.accountValue;
      bVal = b.accountValue;
    } else {
      aVal = (a[sortField] as Record<string, number>)[window] ?? 0;
      bVal = (b[sortField] as Record<string, number>)[window] ?? 0;
    }
    return order === "desc" ? bVal - aVal : aVal - bVal;
  });

  // Re-rank after sort
  traders = traders.map((t, i) => ({ ...t, rank: i + 1 }));

  const total = traders.length;
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;

  const paged = traders.slice(offset, offset + limit);

  return {
    traders: paged,
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  };
}
