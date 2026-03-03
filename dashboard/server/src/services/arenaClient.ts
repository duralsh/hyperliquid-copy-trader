/**
 * Shared Arena API configuration helpers.
 *
 * Centralises `getArenaBaseUrl`, `getArenaApiKey`, and the generic
 * `arenaRequest` helper that were duplicated between accountService and arenaService.
 */

/** Read lazily so dotenv has time to load (ESM hoists imports before dotenv.config()). */
export function getArenaBaseUrl(): string {
  return (process.env.ARENA_BASE_URL ?? "https://api.starsarena.com").replace(/\/$/, "");
}

export function getArenaApiKey(): string {
  const key = process.env.ARENA_API_KEY ?? "";
  if (!key) {
    throw new Error("ARENA_API_KEY is not configured in environment");
  }
  return key;
}

export function buildArenaHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": getArenaApiKey(),
  };
}

/**
 * Generic Arena API request helper.
 *
 * Handles JSON serialisation, error status handling, and empty-body responses.
 */
export async function arenaRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getArenaBaseUrl()}${path}`;
  const init: RequestInit = {
    method,
    headers: buildArenaHeaders(),
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Arena API error ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  const text = await response.text();
  if (!text.trim()) {
    return undefined as unknown as T;
  }
  return JSON.parse(text) as T;
}
