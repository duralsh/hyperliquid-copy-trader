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
