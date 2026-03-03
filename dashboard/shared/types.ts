export interface TraderSummary {
  rank: number;
  address: string;
  accountValue: number;
  displayName: string | null;
  pnl: {
    day: number;
    week: number;
    month: number;
    allTime: number;
  };
  roi: {
    day: number;
    week: number;
    month: number;
    allTime: number;
  };
  volume: {
    day: number;
    week: number;
    month: number;
    allTime: number;
  };
}

export type TimeWindow = "day" | "week" | "month" | "allTime";
export type SortField = "pnl" | "roi" | "volume" | "accountValue";

export interface LeaderboardQuery {
  sort?: SortField;
  window?: TimeWindow;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  minAccountValue?: number;
  maxAccountValue?: number;
}

export interface LeaderboardResponse {
  traders: TraderSummary[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface TraderPosition {
  coin: string;
  szi: string;
  entryPx: string;
  leverage: string;
  liquidationPx: string;
  marginUsed: string;
  returnOnEquity: string;
  unrealizedPnl: string;
}

export interface TraderDetail {
  address: string;
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  positions: TraderPosition[];
}

export interface BotConfig {
  targetWallet: string;
  sizeMultiplier: number;
  maxLeverage: number;
  maxPositionSizePercent: number;
  blockedAssets: string[];
  dryRun: boolean;
}

export interface BotStatus {
  running: boolean;
  targetWallet: string | null;
  activeTradesCount: number;
  activeTrades: string[];
  wsConnected: boolean;
  startedAt: number | null;
  config: BotConfig | null;
}

export interface BotTradeEvent {
  type: "trade" | "error";
  timestamp: number;
  coin?: string;
  action?: string;
  side?: string;
  size?: string;
  price?: string;
  orderId?: string;
  error?: string;
  success?: boolean;
}

export interface BotSwitchingEvent {
  from: string | null;
  to: string;
}

export interface WsMessage {
  event: "bot:status" | "bot:trade" | "bot:error" | "bot:switching";
  data: BotStatus | BotTradeEvent | BotSwitchingEvent;
}

// My Account types
export interface MyAccountPosition {
  coin: string;
  szi: string;
  entryPx: string;
  leverage: string;
  liquidationPx: string;
  marginUsed: string;
  returnOnEquity: string;
  unrealizedPnl: string;
}

export interface MyAccountData {
  address: string;
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
  positions: MyAccountPosition[];
  totalUnrealizedPnl: number;
}

// Arena Feed types
export interface ArenaPost {
  id: string;
  content: string;
  createdAt: string;
  likesCount?: number;
  repostsCount?: number;
  repliesCount?: number;
  user?: {
    id: string;
    handle: string;
    userName: string;
    profilePicture?: string;
  };
}

export interface ArenaFeedResponse {
  posts: ArenaPost[];
  page: number;
  pageSize: number;
}

export interface TokenPrice {
  coin: string;
  price: number;
  change2h: number;
  iconUrl: string | null;
}

// Smart Filter types
export interface SmartFilterTraderResult {
  trader: TraderSummary;
  equityRatio: number;     // userEquity / traderEquity
  estCopySize: number;     // estimated position size when copying
  roi30d: number;          // percentage
  pnl30d: number;
  volumeDaily: number;     // avg daily volume proxy
}

export interface SmartFilterStats {
  total: number;
  afterSize: number;
  afterActivity: number;
  afterPerformance: number;
}

export interface SmartFilterResponse {
  eligible: SmartFilterTraderResult[];
  stats: SmartFilterStats;
  userEquity: number;
  computedAt: number;
}

// Close position result types (shared between server and client)
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

export interface DockerLogEntry {
  time: string;
  text: string;
  stream: "stdout" | "stderr";
}

export interface TraderFill {
  coin: string;
  px: string;
  sz: string;
  side: "A" | "B";
  time: number;
  dir: "Open Long" | "Close Long" | "Open Short" | "Close Short";
  closedPnl: string;
  hash: string;
  fee: string;
  crossed: boolean;
}

// Wallet balance types
export interface WalletBalances {
  ethBalance: number;
  usdcBalance: number;
}

export interface DepositResult {
  txHash: string;
}

export interface WithdrawResult {
  success: boolean;
  error?: string;
}
