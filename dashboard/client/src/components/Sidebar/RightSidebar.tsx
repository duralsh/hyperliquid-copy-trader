import { useState } from "react";
import { MyAccount } from "./MyAccount.js";
import { ArenaFeed } from "./ArenaFeed.js";

type Tab = "account" | "feed";

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  return (
    <aside className="right-sidebar flex flex-col border-l border-border/30 bg-bg-secondary overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border/30">
        <button
          onClick={() => setActiveTab("account")}
          className={`flex-1 px-4 py-2 text-xs font-bold tracking-wider transition-colors relative ${
            activeTab === "account"
              ? "text-green"
              : "text-text-dim hover:text-text"
          }`}
        >
          ACCOUNT
          {activeTab === "account" && (
            <span className="absolute bottom-0 left-0 right-0 h-px bg-green" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex-1 px-4 py-2 text-xs font-bold tracking-wider transition-colors relative ${
            activeTab === "feed"
              ? "text-green"
              : "text-text-dim hover:text-text"
          }`}
        >
          FEED
          {activeTab === "feed" && (
            <span className="absolute bottom-0 left-0 right-0 h-px bg-green" />
          )}
        </button>
      </div>

      {/* Tab content — full height */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "account" ? <MyAccount /> : <ArenaFeed />}
      </div>
    </aside>
  );
}
