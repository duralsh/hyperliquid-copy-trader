import type {
  TraderSummary,
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
  DockerLogEntry,
  WalletBalances,
  DepositResult,
  WithdrawResult,
} from "../../../shared/types.js";

const BASE = "/api";

function getAuthToken(): string | null {
  return localStorage.getItem("hl-auth-token");
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("hl-auth-token");
    window.location.reload();
    throw new Error("Session expired");
  }
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

export function lookupTraders(addresses: string[]): Promise<{ traders: TraderSummary[] }> {
  return fetchJSON(`${BASE}/leaderboard/lookup`, {
    method: "POST",
    body: JSON.stringify({ addresses }),
  });
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
    body: JSON.stringify({ content }),
  });
}

export function deleteArenaPost(threadId: string): Promise<{ success: boolean }> {
  return fetchJSON(`${BASE}/arena/post/${threadId}`, {
    method: "DELETE",
  });
}

// Docker Logs
export function fetchDockerLogs(tail = 500): Promise<DockerLogEntry[]> {
  return fetchJSON(`${BASE}/docker/logs?tail=${tail}`);
}

// Smart Filter
export function fetchSmartFilter(refresh = false): Promise<SmartFilterResponse> {
  const params = refresh ? "?refresh=true" : "";
  return fetchJSON(`${BASE}/smart-filter${params}`);
}

// Wallet
export function fetchWalletBalances(): Promise<WalletBalances> {
  return fetchJSON(`${BASE}/wallet/balances`);
}

export function depositToHL(amount: number): Promise<DepositResult> {
  return fetchJSON(`${BASE}/wallet/deposit`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export function withdrawFromHL(amount: number): Promise<WithdrawResult> {
  return fetchJSON(`${BASE}/wallet/withdraw`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

// Auth
export interface AuthUser {
  id: number;
  username: string;
  role: string;
  walletAddress: string | null;
  onboarded: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function apiLogin(username: string, password: string): Promise<AuthResponse> {
  return fetchJSON(`${BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function apiRegister(username: string, password: string): Promise<AuthResponse> {
  return fetchJSON(`${BASE}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function apiGetMe(): Promise<{ user: AuthUser }> {
  return fetchJSON(`${BASE}/auth/me`);
}

export function apiRegisterAgent(
  privateKey: string,
  agentName: string,
  agentHandle: string,
): Promise<{
  agentId: string;
  apiKey: string;
  verificationCode: string;
  walletAddress: string;
}> {
  return fetchJSON(`${BASE}/auth/onboard/register-agent`, {
    method: "POST",
    body: JSON.stringify({ privateKey, agentName, agentHandle }),
  });
}

export function apiCompleteOnboarding(
  privateKey: string,
  arenaApiKey: string,
): Promise<{ user: AuthUser; walletAddress: string }> {
  return fetchJSON(`${BASE}/auth/onboard/complete`, {
    method: "POST",
    body: JSON.stringify({ privateKey, arenaApiKey }),
  });
}

export function apiFetchFavorites(): Promise<{ favorites: string[] }> {
  return fetchJSON(`${BASE}/favorites`);
}

export function apiAddFavorite(address: string): Promise<{ success: boolean }> {
  return fetchJSON(`${BASE}/favorites/${address}`, { method: "POST" });
}

export function apiRemoveFavorite(address: string): Promise<{ success: boolean }> {
  return fetchJSON(`${BASE}/favorites/${address}`, { method: "DELETE" });
}
