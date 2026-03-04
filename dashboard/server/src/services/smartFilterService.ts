import type {
  TraderSummary,
  SmartFilterTraderResult,
  SmartFilterStats,
  SmartFilterResponse,
} from "../../../shared/types.js";
import { fetchMyAccount } from "./accountService.js";
import { fetchLeaderboard } from "./leaderboardService.js";
import { TTLCache } from "./cache.js";

// ---------------------------------------------------------------------------
// Filter thresholds
// ---------------------------------------------------------------------------

const CACHE_TTL = 5 * 60_000;
const MIN_ACCOUNT_VALUE = 100;
const MAX_ACCOUNT_VALUE = 4_000;
const MIN_EQUITY_RATIO = 0.02;   // user must be >= 2% of target's size
const MIN_EST_COPY_SIZE = 10;    // $10 minimum estimated copy size
const MIN_VOLUME_WEEK = 1_000;   // must have traded at least $1K in 7d
const MIN_ROI_MONTH = 0;         // positive 30d ROI required
const MIN_PNL_MONTH = 0;         // positive 30d PnL required

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new TTLCache<SmartFilterResponse>(CACHE_TTL);

// ---------------------------------------------------------------------------
// Filter passes (all use leaderboard data only — zero extra API calls)
// ---------------------------------------------------------------------------

/** Pass 1: Size — can we meaningfully copy this trader? */
function passSizeCheck(trader: TraderSummary, userEquity: number): boolean {
  if (trader.accountValue <= 0) return false;
  const ratio = userEquity / trader.accountValue;
  if (ratio < MIN_EQUITY_RATIO) return false;

  // Estimate copy size: ratio * (daily volume as a proxy for avg trade size)
  // daily volume / ~10 trades per day ≈ avg notional per trade
  const avgTradeNotional = trader.volume.day > 0 ? trader.volume.day / 10 : 0;
  const estCopy = ratio * avgTradeNotional;
  return estCopy >= MIN_EST_COPY_SIZE;
}

/** Pass 2: Activity — is the trader actively trading? */
function passActivity(trader: TraderSummary): boolean {
  return trader.volume.week >= MIN_VOLUME_WEEK && trader.volume.day > 0;
}

/** Pass 3: Performance — is the trader profitable? */
function passPerformance(trader: TraderSummary): boolean {
  return trader.pnl.month > MIN_PNL_MONTH && trader.roi.month > MIN_ROI_MONTH;
}

/** Build result for an eligible trader. */
function buildResult(trader: TraderSummary, userEquity: number): SmartFilterTraderResult {
  const equityRatio = trader.accountValue > 0 ? userEquity / trader.accountValue : 0;
  const avgTradeNotional = trader.volume.day > 0 ? trader.volume.day / 10 : 0;

  return {
    trader,
    equityRatio,
    estCopySize: equityRatio * avgTradeNotional,
    roi30d: trader.roi.month * 100,
    pnl30d: trader.pnl.month,
    volumeDaily: trader.volume.day,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runSmartFilter(refresh?: boolean, walletAddress?: string): Promise<SmartFilterResponse> {
  if (!refresh) {
    const cached = cache.get();
    if (cached) return cached;
  }

  // Only 2 calls — both already cached by their own services
  const [account, leaderboard] = await Promise.all([fetchMyAccount(walletAddress), fetchLeaderboard()]);
  const userEquity = parseFloat(account.accountValue) || 0;

  // Pre-filter: right account size range + positive PnL
  const candidates = leaderboard.filter(
    (t) =>
      t.accountValue >= MIN_ACCOUNT_VALUE &&
      t.accountValue <= MAX_ACCOUNT_VALUE &&
      t.pnl.month > 0,
  );

  const stats: SmartFilterStats = {
    total: candidates.length,
    afterSize: 0,
    afterActivity: 0,
    afterPerformance: 0,
  };

  // Pass 1: Size
  const afterSize = candidates.filter((t) => passSizeCheck(t, userEquity));
  stats.afterSize = afterSize.length;

  // Pass 2: Activity
  const afterActivity = afterSize.filter((t) => passActivity(t));
  stats.afterActivity = afterActivity.length;

  // Pass 3: Performance
  const afterPerformance = afterActivity.filter((t) => passPerformance(t));
  stats.afterPerformance = afterPerformance.length;

  // Sort eligible by 30d ROI descending
  afterPerformance.sort((a, b) => b.roi.month - a.roi.month);

  const eligible = afterPerformance.map((t) => buildResult(t, userEquity));

  const response: SmartFilterResponse = {
    eligible,
    stats,
    userEquity,
    computedAt: Date.now(),
  };

  cache.set(response);
  return response;
}
