import { hyperliquidClient } from "../client/hyperliquidClient.js";
import { config } from "../config.js";
import type { HlAssetPosition, HlClearinghouseState, HlOpenOrder } from "../types.js";

// Known DEXes - empty string for main/default DEX
const KNOWN_DEXES = ["", "xyz", "flx", "vntl", "hyna", "km", "abcd", "cash"];

/**
 * Returns all open positions for the configured main wallet address across all DEXs.
 * Only returns positions with non-zero size.
 */
export async function getPositions(
  walletAddress = config.mainWalletAddress
): Promise<HlAssetPosition[]> {
  if (!walletAddress) {
    throw new Error(
      "MAIN_WALLET_ADDRESS is not set. Add it to your .env file."
    );
  }

  // Query all known DEXs in parallel and aggregate positions
  const results = await Promise.allSettled(
    KNOWN_DEXES.map((dex) =>
      hyperliquidClient().getClearinghouseState(
        walletAddress,
        dex === "" ? undefined : dex
      )
    )
  );

  const allPositions: HlAssetPosition[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const positions = result.value.assetPositions.filter(
        (ap) => parseFloat(ap.position.szi) !== 0
      );
      allPositions.push(...positions);
    }
    // Silently skip DEXs that error (user might not have positions there)
  }

  return allPositions;
}

/**
 * Returns the full clearing house state (account summary + positions) for default DEX.
 */
export async function getClearinghouseState(
  walletAddress = config.mainWalletAddress
): Promise<HlClearinghouseState> {
  if (!walletAddress) {
    throw new Error(
      "MAIN_WALLET_ADDRESS is not set. Add it to your .env file."
    );
  }
  return hyperliquidClient().getClearinghouseState(walletAddress);
}

/**
 * Returns all open orders for the configured main wallet address across all DEXs.
 */
export async function getOpenOrders(
  walletAddress = config.mainWalletAddress
): Promise<HlOpenOrder[]> {
  if (!walletAddress) {
    throw new Error(
      "MAIN_WALLET_ADDRESS is not set. Add it to your .env file."
    );
  }
  
  // Query all known DEXs in parallel and aggregate orders
  const results = await Promise.allSettled(
    KNOWN_DEXES.map((dex) =>
      hyperliquidClient().getOpenOrders(
        walletAddress,
        dex === "" ? undefined : dex
      )
    )
  );

  const allOrders: HlOpenOrder[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allOrders.push(...result.value);
    }
    // Silently skip DEXs that error
  }

  return allOrders;
}
