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
      {/* Post input -- chat-style bar pinned at top */}
      <div className="px-4 py-3 border-b border-[#1e2a35]/60 shrink-0 bg-[#0a0e14]/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="post to arena..."
            className="flex-1 bg-[#0a0e14] border border-[#1e2a35]/60 rounded px-3 py-2 text-text text-xs focus:border-green/60 focus:outline-none focus:shadow-[0_0_8px_rgba(0,255,65,0.1),inset_0_1px_4px_rgba(0,0,0,0.3)] transition-all duration-300"
            style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}
          />
          <button
            onClick={handlePost}
            disabled={createPost.isPending || !postText.trim()}
            className="px-3 py-2 border border-green/40 text-green text-xs font-bold tracking-wider hover:bg-green/10 hover:border-green hover:shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all duration-300 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none shrink-0"
          >
            {createPost.isPending ? "..." : "SEND"}
          </button>
        </div>
        {createPost.error && (
          <div className="text-red text-xs mt-1.5 px-2 py-1 bg-red/5 border-l-2 border-red/40 rounded-r">
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
          <div className="text-red text-xs py-4 px-4 bg-red/5 border-l-2 border-red/40 mx-4 mt-3 rounded-r">
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
                className="px-4 py-3 hover:bg-[#151b23]/40 transition-all duration-200 group relative border-b border-[#1e2a35]/20"
              >
                {/* Handle + time on one line */}
                <div className="flex items-center gap-2 mb-1.5">
                  {post.user && (
                    <span className="text-amber text-xs font-bold" style={{ textShadow: '0 0 6px rgba(255,176,0,0.15)' }}>
                      @{post.user.handle}
                    </span>
                  )}
                  <span className="text-text-dim/60 text-[10px] tabular-nums">
                    {timeAgo(post.createdAt)}
                  </span>
                </div>

                {/* Content */}
                <div className="text-text text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {stripHtml(post.content)}
                </div>

                {/* Stats inline */}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-text-dim">
                  {(post.likesCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#151b23]/60 border border-[#1e2a35]/30">{post.likesCount}&#9829;</span>
                  )}
                  {(post.repostsCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#151b23]/60 border border-[#1e2a35]/30">{post.repostsCount}&#8635;</span>
                  )}
                  {(post.repliesCount ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#151b23]/60 border border-[#1e2a35]/30">{post.repliesCount}&#8617;</span>
                  )}
                </div>

                {/* Delete button -- appears on hover, top-right */}
                <button
                  onClick={() => deletePost.mutate(post.id)}
                  disabled={deletePost.isPending}
                  className="absolute top-3 right-4 opacity-0 group-hover:opacity-100 text-text-dim hover:text-red text-xs transition-all duration-300 hover:bg-red/10 w-6 h-6 rounded flex items-center justify-center"
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
