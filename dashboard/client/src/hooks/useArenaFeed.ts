import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArenaFeed, createArenaPost, deleteArenaPost } from "../services/api.js";

export function useArenaFeed(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["arenaFeed", page, pageSize],
    queryFn: () => fetchArenaFeed(page, pageSize),
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createArenaPost(content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arenaFeed"] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => deleteArenaPost(threadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arenaFeed"] }),
  });
}
