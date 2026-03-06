import { useState } from "react";
import { MyAccount } from "./MyAccount.js";
import { ArenaFeed } from "./ArenaFeed.js";
import { LoginPanel } from "../Auth/LoginPanel.js";
import { OnboardingPanel } from "../Auth/OnboardingPanel.js";
import { useAuth } from "../../hooks/useAuth.js";
import type { BotStatus } from "../../../../shared/types.js";

type Tab = "account" | "feed";

interface Props {
  botStatus: BotStatus | null;
  onViewTrader: (address: string) => void;
  isSwitching?: boolean;
}

export function RightSidebar({ botStatus, onViewTrader, isSwitching }: Props) {
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center border-l border-[#1e2a35]/60 bg-gradient-to-b from-[#0f1419] to-[#0a0e14] py-2 w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="text-text-dim hover:text-green transition-all duration-300 p-1.5 rounded hover:bg-green/5 hover:shadow-[0_0_8px_rgba(0,255,65,0.15)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
      </aside>
    );
  }

  // Not authenticated -> show login
  if (!isAuthenticated) {
    return (
      <aside className="right-sidebar flex flex-col border-l border-[#1e2a35]/60 bg-gradient-to-b from-[#0f1419] to-[#0a0e14] overflow-hidden" style={{ boxShadow: 'inset 1px 0 0 rgba(0,255,65,0.05)' }}>
        <div className="flex shrink-0 border-b border-[#1e2a35]/60 items-center justify-between bg-[#0a0e14]/50 backdrop-blur-sm">
          <span className="px-4 py-2.5 text-xs font-bold tracking-wider text-text-dim">SESSION</span>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="px-2 py-2 text-text-dim hover:text-amber transition-all duration-300 hover:bg-amber/5 rounded-sm mr-1"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 4 10 8 6 12" />
            </svg>
          </button>
        </div>
        <LoginPanel />
      </aside>
    );
  }

  // Authenticated but not onboarded -> show onboarding
  if (!user?.onboarded) {
    return (
      <aside className="right-sidebar flex flex-col border-l border-[#1e2a35]/60 bg-gradient-to-b from-[#0f1419] to-[#0a0e14] overflow-hidden" style={{ boxShadow: 'inset 1px 0 0 rgba(0,255,65,0.05)' }}>
        <div className="flex shrink-0 border-b border-[#1e2a35]/60 items-center justify-between bg-[#0a0e14]/50 backdrop-blur-sm">
          <span className="px-4 py-2.5 text-xs font-bold tracking-wider text-amber" style={{ textShadow: '0 0 8px rgba(255,176,0,0.3)' }}>SETUP</span>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="px-2 py-2 text-text-dim hover:text-amber transition-all duration-300 hover:bg-amber/5 rounded-sm mr-1"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 4 10 8 6 12" />
            </svg>
          </button>
        </div>
        <OnboardingPanel />
      </aside>
    );
  }

  // Authenticated + onboarded -> normal tabs
  return (
    <aside className="right-sidebar flex flex-col border-l border-[#1e2a35]/60 bg-gradient-to-b from-[#0f1419] to-[#0a0e14] overflow-hidden" style={{ boxShadow: 'inset 1px 0 0 rgba(0,255,65,0.05)' }}>
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[#1e2a35]/60 bg-[#0a0e14]/50 backdrop-blur-sm">
        {(["account", "feed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 text-xs font-bold tracking-wider transition-all duration-300 relative ${
              activeTab === tab
                ? "text-green"
                : "text-text-dim hover:text-text hover:bg-[#151b23]/50"
            }`}
          >
            {tab.toUpperCase()}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #00ff41, transparent)', boxShadow: '0 0 6px rgba(0,255,65,0.4)' }} />
            )}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          className="px-2 py-2 text-text-dim hover:text-amber transition-all duration-300 hover:bg-amber/5 rounded-sm mr-1"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform duration-300 hover:translate-x-0.5">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>

      {/* Tab content -- full height */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "account" && <MyAccount botStatus={botStatus} onViewTrader={onViewTrader} isSwitching={isSwitching} />}
        {activeTab === "feed" && <ArenaFeed />}
      </div>
    </aside>
  );
}
