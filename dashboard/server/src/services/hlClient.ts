/**
 * Shared Hyperliquid Info API helper.
 *
 * Centralises the repeated `fetch(HL_INFO_URL, { method: "POST", ... })` pattern
 * that was duplicated across priceService, accountService, and traderService.
 */

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

export interface ClearinghouseState {
  marginSummary?: Record<string, string>;
  assetPositions?: { position?: Record<string, unknown> }[];
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
