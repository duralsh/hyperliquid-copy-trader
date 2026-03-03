import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchLeaderboard } from "../services/api.js";
import type { LeaderboardQuery } from "../../../shared/types.js";

const PAGE_SIZE = 50;

export function useLeaderboard(query: Omit<LeaderboardQuery, "offset" | "limit">) {
  return useInfiniteQuery({
    queryKey: ["leaderboard", query],
    queryFn: ({ pageParam = 0 }) =>
      fetchLeaderboard({ ...query, offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
    refetchInterval: 60_000,
  });
}
