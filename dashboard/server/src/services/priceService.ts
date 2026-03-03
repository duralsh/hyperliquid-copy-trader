import type { TokenPrice } from "../../../shared/types.js";
import { hlInfoRequest } from "./hlClient.js";

const TRACKED_COINS = [
  "BTC", "ETH", "SOL", "DOGE", "AVAX", "LINK",
  "SUI", "HYPE", "ARB", "MATIC", "OP", "PEPE", "WIF",
];

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Maps display names → Hyperliquid allMids ticker names.
 * Some coins are listed under different symbols on Hyperliquid (e.g. PEPE → kPEPE).
 * If a display name is NOT in this map the display name itself is used as-is.
 */
const HL_TICKER_ALIASES: Record<string, string> = {
  PEPE: "kPEPE",
};

// CoinGecko ID mapping for icon lookups
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  SUI: "sui",
  HYPE: "hyperliquid",
  ARB: "arbitrum",
  MATIC: "matic-network",
  OP: "optimism",
  PEPE: "pepe",
  WIF: "dogwifcoin",
};

// Icon cache — refreshed every 6 hours (icons never change)
const ICON_CACHE_TTL = 6 * 60 * 60 * 1000;
let iconCache: Record<string, string> = {};
let iconCacheAt = 0;

async function fetchIconUrls(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(iconCache).length > 0 && now - iconCacheAt < ICON_CACHE_TTL) {
    return iconCache;
  }

  const ids = Object.values(COINGECKO_IDS).join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=50`,
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) {
      console.warn(`CoinGecko icon fetch failed: ${res.status}`);
      return iconCache; // return stale cache on failure
    }
    const data = (await res.json()) as Array<{ id: string; image: string }>;

    // Build symbol → icon URL map
    const newCache: Record<string, string> = {};
    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      const coin = data.find((c) => c.id === geckoId);
      if (coin?.image) {
        newCache[symbol] = coin.image;
      }
    }
    iconCache = newCache;
    iconCacheAt = now;
    return iconCache;
  } catch (err: unknown) {
    console.warn("Failed to fetch CoinGecko icons:", err);
    return iconCache;
  }
}

const CACHE_TTL_MS = 30_000;

let cachedPrices: TokenPrice[] | null = null;
let cachedAt = 0;

async function fetchAllMids(): Promise<Record<string, string>> {
  const raw = await hlInfoRequest<Record<string, string>>({ type: "allMids" });

  // Build a reverse alias map: HL ticker → display name (e.g. "kPEPE" → "PEPE")
  const reverseAlias: Record<string, string> = {};
  for (const [display, hlTicker] of Object.entries(HL_TICKER_ALIASES)) {
    reverseAlias[hlTicker] = display;
  }

  // Re-key aliased entries so downstream code can look up by display name
  for (const [hlTicker, display] of Object.entries(reverseAlias)) {
    if (hlTicker in raw) {
      raw[display] = raw[hlTicker];
    }
  }

  return raw;
}

/**
 * Fetches ALL available xyz DEX markets (stocks, commodities, indices, etc.).
 * Returns a map of display name → price string.
 * Also returns a parallel map of display name → full xyz coin identifier for candle lookups.
 */
async function fetchXyzMids(): Promise<{
  mids: Record<string, string>;
  xyzCoinMap: Record<string, string>;
}> {
  try {
    interface XyzMarket { name?: string }
    interface XyzAssetCtx { midPx?: string; markPx?: string }
    const meta = await hlInfoRequest<[{ universe?: XyzMarket[] }, XyzAssetCtx[]]>({ type: "metaAndAssetCtxs", dex: "xyz" });
    const universe = meta[0]?.universe ?? [];
    const assetCtxs = meta[1] ?? [];

    const mids: Record<string, string> = {};
    const xyzCoinMap: Record<string, string> = {};

    for (let i = 0; i < universe.length; i++) {
      const market = universe[i];
      const assetCtx = assetCtxs[i];
      if (market?.name && assetCtx) {
        const price = assetCtx.midPx || assetCtx.markPx;
        // Skip markets with no price (None / null)
        if (!price || price === "None") continue;

        // market.name is like "xyz:AAPL" — strip the prefix for display
        const displayName = market.name.replace(/^xyz:/, "");
        mids[displayName] = price;
        // Store the full identifier for candle lookups (e.g. "xyz:AAPL")
        xyzCoinMap[displayName] = market.name;
      }
    }
    return { mids, xyzCoinMap };
  } catch (err: unknown) {
    console.warn("Failed to fetch xyz DEX mids:", err);
    return { mids: {}, xyzCoinMap: {} };
  }
}

interface Candle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

/**
 * Fetches the closing price from ~2 hours ago.
 * @param coin - display name (e.g. "BTC", "PEPE")
 * @param candleCoinOverride - optional full coin identifier for the candle API (e.g. "xyz:AAPL")
 */
async function fetchCandle2hAgo(coin: string, candleCoinOverride?: string): Promise<number | null> {
  const now = Date.now();
  const twoHoursAgo = now - TWO_HOURS_MS;

  // Use override if provided (for xyz markets), otherwise apply alias mapping for perps.
  const candleCoin = candleCoinOverride ?? HL_TICKER_ALIASES[coin] ?? coin;

  try {
    const candles = await hlInfoRequest<Candle[]>({
      type: "candleSnapshot",
      req: {
        coin: candleCoin,
        interval: "1h",
        startTime: twoHoursAgo,
        endTime: now,
      },
    });
    if (!candles || candles.length === 0) return null;

    return parseFloat(candles[0].c);
  } catch {
    return null;
  }
}

export async function getTokenPrices(): Promise<TokenPrice[]> {
  const now = Date.now();
  if (cachedPrices && now - cachedAt < CACHE_TTL_MS) {
    return cachedPrices;
  }

  // Fetch standard mids, all xyz DEX markets, and icons in parallel
  const [mids, xyzData, icons] = await Promise.all([
    fetchAllMids(),
    fetchXyzMids(),
    fetchIconUrls(),
  ]);

  const { mids: xyzMids, xyzCoinMap } = xyzData;

  // --- Standard tracked coins (with candle lookups) ---
  const standardCandleResults = await Promise.all(
    TRACKED_COINS.map(async (coin) => {
      const price2hAgo = await fetchCandle2hAgo(coin);
      return { coin, price2hAgo };
    }),
  );

  const prices: TokenPrice[] = [];

  for (const { coin, price2hAgo } of standardCandleResults) {
    const midStr = mids[coin];
    if (!midStr) continue;

    const currentPrice = parseFloat(midStr);
    if (isNaN(currentPrice)) continue;

    let change2h = 0;
    if (price2hAgo && price2hAgo > 0) {
      change2h = ((currentPrice - price2hAgo) / price2hAgo) * 100;
    }

    prices.push({
      coin,
      price: currentPrice,
      change2h,
      iconUrl: icons[coin] ?? null,
    });
  }

  // --- All xyz DEX markets (stocks, commodities, indices, etc.) ---
  const xyzDisplayNames = Object.keys(xyzMids);
  const xyzCandleResults = await Promise.all(
    xyzDisplayNames.map(async (displayName) => {
      const fullCoin = xyzCoinMap[displayName]; // e.g. "xyz:AAPL"
      const price2hAgo = await fetchCandle2hAgo(displayName, fullCoin);
      return { displayName, price2hAgo };
    }),
  );

  for (const { displayName, price2hAgo } of xyzCandleResults) {
    const midStr = xyzMids[displayName];
    if (!midStr) continue;

    const currentPrice = parseFloat(midStr);
    if (isNaN(currentPrice)) continue;

    let change2h = 0;
    if (price2hAgo && price2hAgo > 0) {
      change2h = ((currentPrice - price2hAgo) / price2hAgo) * 100;
    }

    prices.push({
      coin: displayName,
      price: currentPrice,
      change2h,
      iconUrl: null, // CoinGecko doesn't have stocks/commodities
    });
  }

  cachedPrices = prices;
  cachedAt = Date.now();

  return prices;
}
