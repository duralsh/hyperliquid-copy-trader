import type { TokenPrice } from "../../../shared/types.js";

const HL_INFO_URL = "https://api-ui.hyperliquid.xyz/info";

const TRACKED_COINS = [
  "BTC", "ETH", "SOL", "DOGE", "AVAX", "LINK",
  "SUI", "HYPE", "ARB", "MATIC", "OP", "PEPE", "WIF", "XYZ",
];

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
  XYZ: "xyzverse",
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
  } catch (err) {
    console.warn("Failed to fetch CoinGecko icons:", err);
    return iconCache;
  }
}

const CACHE_TTL_MS = 30_000;

let cachedPrices: TokenPrice[] | null = null;
let cachedAt = 0;

async function fetchAllMids(): Promise<Record<string, string>> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  if (!res.ok) {
    throw new Error(`allMids request failed: ${res.status}`);
  }
  return res.json() as Promise<Record<string, string>>;
}

async function fetchXyzMids(): Promise<Record<string, string>> {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
    });
    if (!res.ok) {
      return {};
    }
    const meta = (await res.json()) as any[];
    const universe = meta[0]?.universe || [];
    const assetCtxs = meta[1] || [];

    const mids: Record<string, string> = {};
    for (let i = 0; i < universe.length; i++) {
      const market = universe[i];
      const assetCtx = assetCtxs[i];
      if (market?.name && assetCtx) {
        // Extract the symbol without "xyz:" prefix for matching
        const symbol = market.name.replace(/^xyz:/, "");
        const price = assetCtx.midPx || assetCtx.markPx || "0";
        mids[symbol] = price;
      }
    }
    return mids;
  } catch {
    return {};
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

async function fetchCandle2hAgo(coin: string): Promise<number | null> {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;

  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin,
        interval: "1h",
        startTime: twoHoursAgo,
        endTime: now,
      },
    }),
  });

  if (!res.ok) return null;

  const candles = (await res.json()) as Candle[];
  if (!candles || candles.length === 0) return null;

  return parseFloat(candles[0].c);
}

export async function getTokenPrices(): Promise<TokenPrice[]> {
  const now = Date.now();
  if (cachedPrices && now - cachedAt < CACHE_TTL_MS) {
    return cachedPrices;
  }

  // Fetch prices and icons in parallel
  const [mids, xyzMids, icons, ...candleResults] = await Promise.all([
    fetchAllMids(),
    fetchXyzMids(),
    fetchIconUrls(),
    ...TRACKED_COINS.map(async (coin) => {
      const price2hAgo = await fetchCandle2hAgo(coin);
      return { coin, price2hAgo };
    }),
  ]);

  // Merge standard and XYZ mids
  const allMids = { ...mids, ...xyzMids };

  const prices: TokenPrice[] = [];

  for (const result of candleResults) {
    const { coin, price2hAgo } = result;
    const midStr = allMids[coin];
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

  cachedPrices = prices;
  cachedAt = Date.now();

  return prices;
}
