import type { ArenaPost, ArenaFeedResponse } from "../../../shared/types.js";

/** Read lazily so dotenv has time to load (ESM hoists imports before dotenv.config()). */
function getArenaBaseUrl(): string {
  return (process.env.ARENA_BASE_URL ?? "https://api.starsarena.com").replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env.ARENA_API_KEY ?? "";
  if (!key) {
    throw new Error("ARENA_API_KEY is not configured in environment");
  }
  return key;
}

function buildHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": getApiKey(),
  };
}

async function arenaRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getArenaBaseUrl()}${path}`;
  const init: RequestInit = {
    method,
    headers: buildHeaders(),
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

export async function fetchMyFeed(page = 1, pageSize = 20): Promise<ArenaFeedResponse> {
  const data = await arenaRequest<{ threads?: ArenaPost[] }>(
    "GET",
    `/agents/threads/feed/my?page=${page}&pageSize=${pageSize}`
  );

  const threads = data?.threads ?? [];
  const posts: ArenaPost[] = threads.map((t: Record<string, unknown>) => ({
    id: String(t.id ?? ""),
    content: String(t.content ?? ""),
    createdAt: String(t.createdAt ?? t.createdOn ?? ""),
    likesCount: Number(t.likesCount ?? 0),
    repostsCount: Number(t.repostsCount ?? 0),
    repliesCount: Number(t.repliesCount ?? t.answersCount ?? 0),
    user: t.user
      ? {
          id: String((t.user as Record<string, unknown>).id ?? ""),
          handle: String((t.user as Record<string, unknown>).handle ?? ""),
          userName: String((t.user as Record<string, unknown>).userName ?? ""),
          profilePicture: ((t.user as Record<string, unknown>).profilePicture as string) ?? undefined,
        }
      : undefined,
  }));

  return { posts, page, pageSize };
}

export async function createPost(content: string): Promise<ArenaPost> {
  const data = await arenaRequest<Record<string, unknown>>(
    "POST",
    "/agents/threads",
    {
      content: content.replace(/\n/g, "<br>"),
      files: [],
    }
  );

  return {
    id: String(data?.id ?? data?.threadId ?? ""),
    content: String(data?.content ?? content),
    createdAt: String(data?.createdAt ?? data?.createdOn ?? new Date().toISOString()),
    likesCount: 0,
    repostsCount: 0,
    repliesCount: 0,
  };
}

export async function deletePost(threadId: string): Promise<void> {
  await arenaRequest<unknown>(
    "DELETE",
    `/agents/threads?threadId=${threadId}`
  );
}
