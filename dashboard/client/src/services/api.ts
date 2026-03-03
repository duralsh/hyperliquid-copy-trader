import type {
  TraderDetail,
  TraderFill,
  BotStatus,
  BotConfig,
  LeaderboardQuery,
  LeaderboardResponse,
  MyAccountData,
  ArenaFeedResponse,
  ArenaPost,
  SmartFilterResponse,
  CloseAllResult,
  ClosePositionResult,
} from "../../../shared/types.js";

const BASE = "/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchLeaderboard(query: LeaderboardQuery = {}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (query.sort) params.set("sort", query.sort);
  if (query.window) params.set("window", query.window);
  if (query.order) params.set("order", query.order);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  if (query.minAccountValue !== undefined) params.set("minAccountValue", String(query.minAccountValue));
  if (query.maxAccountValue !== undefined) params.set("maxAccountValue", String(query.maxAccountValue));
  return fetchJSON(`${BASE}/leaderboard?${params}`);
}

export function fetchTraderPositions(address: string): Promise<TraderDetail> {
  return fetchJSON(`${BASE}/trader/${address}/positions`);
}

export function fetchTraderFills(address: string): Promise<TraderFill[]> {
  return fetchJSON(`${BASE}/trader/${address}/fills`);
}

export function startBot(config: BotConfig): Promise<BotStatus> {
  return fetchJSON(`${BASE}/bot/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export function stopBot(): Promise<BotStatus> {
  return fetchJSON(`${BASE}/bot/stop`, { method: "POST" });
}

// My Account
export function fetchMyAccount(): Promise<MyAccountData> {
  return fetchJSON(`${BASE}/account`);
}

export function closeAllPositions(): Promise<CloseAllResult> {
  return fetchJSON(`${BASE}/account/close-all`, { method: "POST" });
}

export function closePosition(coin: string): Promise<ClosePositionResult> {
  return fetchJSON(`${BASE}/account/close-position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coin }),
  });
}

// Arena Feed
export function fetchArenaFeed(page = 1, pageSize = 20): Promise<ArenaFeedResponse> {
  return fetchJSON(`${BASE}/arena/feed?page=${page}&pageSize=${pageSize}`);
}

export function createArenaPost(content: string): Promise<ArenaPost> {
  return fetchJSON(`${BASE}/arena/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export function deleteArenaPost(threadId: string): Promise<{ success: boolean }> {
  return fetchJSON(`${BASE}/arena/post/${threadId}`, {
    method: "DELETE",
  });
}

// Smart Filter
export function fetchSmartFilter(refresh = false): Promise<SmartFilterResponse> {
  const params = refresh ? "?refresh=true" : "";
  return fetchJSON(`${BASE}/smart-filter${params}`);
}
