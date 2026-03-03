import { useState } from "react";
import { MyAccount } from "./MyAccount.js";
import { ArenaFeed } from "./ArenaFeed.js";
import { DockerLogs } from "./DockerLogs.js";
import type { BotStatus, DockerLogEntry } from "../../../../shared/types.js";

type Tab = "account" | "feed" | "logs";

interface Props {
  botStatus: BotStatus | null;
  dockerLogs: DockerLogEntry[];
  onViewTrader: (address: string) => void;
  isSwitching?: boolean;
}

export function RightSidebar({ botStatus, dockerLogs, onViewTrader, isSwitching }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center border-l border-border/30 bg-bg-secondary py-2 w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="text-text-dim hover:text-green transition-colors p-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-sidebar flex flex-col border-l border-border/30 bg-bg-secondary overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border/30">
        {(["account", "feed", "logs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-xs font-bold tracking-wider transition-colors relative ${
              activeTab === tab
                ? "text-green"
                : "text-text-dim hover:text-text"
            }`}
          >
            {tab.toUpperCase()}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-green" />
            )}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          className="px-2 py-2 text-text-dim hover:text-amber transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>

      {/* Tab content — full height */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "account" && <MyAccount botStatus={botStatus} onViewTrader={onViewTrader} isSwitching={isSwitching} />}
        {activeTab === "feed" && <ArenaFeed />}
        {activeTab === "logs" && <DockerLogs logs={dockerLogs} />}
      </div>
    </aside>
  );
}
