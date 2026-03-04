/**
 * Shared Hyperliquid Info API helper.
 *
 * Centralises the repeated `fetch(HL_INFO_URL, { method: "POST", ... })` pattern
 * that was duplicated across priceService, accountService, and traderService.
 */

import type { TraderPosition } from "../../../shared/types.js";

export const HL_INFO_URL = "https://api-ui.hyperliquid.xyz/info";

/**
 * Send a typed POST request to the Hyperliquid info endpoint.
 *
 * @param body  JSON body — must contain at least `{ type: string }`.
 * @returns     Parsed JSON response typed as `T`.
 * @throws      On non-OK HTTP status.
 */
export async function hlInfoRequest<T = unknown>(
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid info request failed (${body.type}): ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Shared clearinghouse helpers
// (were copy-pasted between accountService and traderService)
// ---------------------------------------------------------------------------

/** DEXes to query — main perps clearinghouse + xyz (HIP-3) DEX. */
export const ACCOUNT_DEXES: (string | undefined)[] = [undefined, "xyz"];

export interface ClearinghousePosition {
  coin?: string;
  szi?: string;
  entryPx?: string;
  leverage?: { value?: string | number };
  liquidationPx?: string;
  marginUsed?: string;
  returnOnEquity?: string;
  unrealizedPnl?: string;
}

export interface ClearinghouseState {
  marginSummary?: Record<string, string>;
  assetPositions?: { position?: ClearinghousePosition }[];
}

/**
 * Fetch clearinghouse state for a single DEX.
 * Returns `null` for DEXes the user never interacted with or on failure.
 */
export async function fetchClearinghouseForDex(
  address: string,
  dex?: string,
): Promise<ClearinghouseState | null> {
  const body: Record<string, unknown> = { type: "clearinghouseState", user: address };
  if (dex !== undefined) body.dex = dex;

  try {
    const json = await hlInfoRequest<unknown>(body);
    if (!json || typeof json !== "object") return null;
    return json as ClearinghouseState;
  } catch {
    return null;
  }
}

/**
 * Extract TraderPosition[] from a clearinghouse state response.
 * Shared by traderService and accountService.
 */
export function extractPositions(state: ClearinghouseState): TraderPosition[] {
  const positions: TraderPosition[] = [];
  for (const ap of state.assetPositions ?? []) {
    const p = ap.position;
    if (!p || parseFloat(String(p.szi)) === 0) continue;
    positions.push({
      coin: String(p.coin),
      szi: String(p.szi),
      entryPx: String(p.entryPx ?? "0"),
      leverage: String(p.leverage?.value ?? "1"),
      liquidationPx: String(p.liquidationPx ?? "0"),
      marginUsed: String(p.marginUsed ?? "0"),
      returnOnEquity: String(p.returnOnEquity ?? "0"),
      unrealizedPnl: String(p.unrealizedPnl ?? "0"),
    });
  }
  return positions;
}
