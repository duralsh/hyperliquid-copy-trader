import type { ArenaPost, ArenaFeedResponse } from "../../../shared/types.js";
import { arenaRequest } from "./arenaClient.js";

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
