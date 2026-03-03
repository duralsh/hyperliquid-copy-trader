import { useRef, useEffect, useState, useCallback } from "react";
import type { DockerLogEntry } from "../../../../shared/types.js";

interface Props {
  logs: DockerLogEntry[];
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return iso.slice(11, 19);
  }
}

function levelColor(text: string): string {
  if (text.includes("[ERROR]")) return "text-red";
  if (text.includes("[WARN]")) return "text-amber";
  if (text.includes("[INFO]")) return "text-green";
  if (text.includes("[DEBUG]")) return "text-text-dim";
  return "text-text";
}

export function DockerLogs({ logs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState<DockerLogEntry[]>(logs);

  // Sync incoming logs unless paused
  useEffect(() => {
    if (!paused) {
      setVisibleLogs(logs);
    }
  }, [logs, paused]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLogs, autoScroll, paused]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const handleClear = useCallback(() => {
    setVisibleLogs([]);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (p) setVisibleLogs(logs); // resume: catch up
      return !p;
    });
  }, [logs]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 shrink-0">
        <span className="text-text-dim text-xs tabular-nums">
          {visibleLogs.length} lines
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              paused
                ? "text-amber border-amber/40 bg-amber/10"
                : "text-text-dim border-border hover:text-text"
            }`}
          >
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button
            onClick={handleClear}
            className="text-xs px-2 py-0.5 rounded border border-border text-text-dim hover:text-red hover:border-red/40 transition-colors"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto min-h-0 font-mono"
      >
        {visibleLogs.length === 0 && (
          <div className="text-text-dim text-xs text-center py-8">
            {logs.length === 0
              ? "no logs — container may not be running"
              : "cleared"}
          </div>
        )}

        {visibleLogs.map((entry, i) => (
          <div
            key={i}
            className={`px-4 py-0.5 text-[11px] leading-relaxed whitespace-pre-wrap break-all ${
              entry.stream === "stderr" ? "bg-red/5" : ""
            }`}
          >
            <span className="text-text-dim">{formatTime(entry.time)}</span>
            {" "}
            <span className={levelColor(entry.text)}>{entry.text}</span>
          </div>
        ))}
      </div>

      {/* Scroll indicator */}
      {!autoScroll && !paused && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-2 right-4 text-xs px-3 py-1 rounded bg-green/15 text-green border border-green/30 hover:bg-green/25 transition-colors"
        >
          scroll to bottom
        </button>
      )}
    </div>
  );
}
