import { useState } from "react";
import { useArenaFeed, useCreatePost, useDeletePost } from "../../hooks/useArenaFeed.js";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function ArenaFeed() {
  const [postText, setPostText] = useState("");
  const { data, isLoading, error } = useArenaFeed();
  const createPost = useCreatePost();
  const deletePost = useDeletePost();

  const handlePost = () => {
    const text = postText.trim();
    if (!text) return;
    createPost.mutate(text, {
      onSuccess: () => setPostText(""),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Post input — chat-style bar pinned at top */}
      <div className="px-4 py-3 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="post to arena..."
            className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-text text-xs focus:border-green focus:outline-none"
          />
          <button
            onClick={handlePost}
            disabled={createPost.isPending || !postText.trim()}
            className="px-3 py-1.5 border border-green text-green text-xs hover:bg-green/10 transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {createPost.isPending ? "..." : "SEND"}
          </button>
        </div>
        {createPost.error && (
          <div className="text-red text-xs mt-1.5">
            ERR: {(createPost.error as Error).message}
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-auto min-h-0">
        {isLoading && (
          <div className="text-green text-xs py-8 text-center">
            loading feed<span className="cursor-blink">_</span>
          </div>
        )}

        {error && (
          <div className="text-red text-xs py-4 px-4">
            ERR: {(error as Error).message}
          </div>
        )}

        {data && data.posts.length === 0 && (
          <div className="text-text-dim text-xs text-center py-8">
            no posts yet
          </div>
        )}

        {data && data.posts.length > 0 && (
          <div>
            {data.posts.map((post) => (
              <div
                key={post.id}
                className="px-4 py-3 hover:bg-bg-tertiary/50 transition-colors group relative"
              >
                {/* Handle + time on one line */}
                <div className="flex items-center gap-2 mb-1">
                  {post.user && (
                    <span className="text-amber text-xs font-bold">
                      @{post.user.handle}
                    </span>
                  )}
                  <span className="text-text-dim text-xs">
                    {timeAgo(post.createdAt)}
                  </span>
                </div>

                {/* Content */}
                <div className="text-text text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {stripHtml(post.content)}
                </div>

                {/* Stats inline */}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-dim">
                  {(post.likesCount ?? 0) > 0 && (
                    <span>{post.likesCount}&#9829;</span>
                  )}
                  {(post.repostsCount ?? 0) > 0 && (
                    <span>{post.repostsCount}&#8635;</span>
                  )}
                  {(post.repliesCount ?? 0) > 0 && (
                    <span>{post.repliesCount}&#8617;</span>
                  )}
                </div>

                {/* Delete button — appears on hover, top-right */}
                <button
                  onClick={() => deletePost.mutate(post.id)}
                  disabled={deletePost.isPending}
                  className="absolute top-3 right-4 opacity-0 group-hover:opacity-100 text-text-dim hover:text-red text-xs transition-all"
                  title="Delete post"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
