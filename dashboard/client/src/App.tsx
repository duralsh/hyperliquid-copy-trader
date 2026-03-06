import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { LeaderboardTable } from "./components/Leaderboard/LeaderboardTable.js";
import { TraderDetailPanel } from "./components/TraderDetail/TraderDetailPanel.js";
import { CopyTraderForm } from "./components/BotStatus/CopyTraderForm.js";
import { StatusPanel } from "./components/BotStatus/StatusPanel.js";
import { TradeLog } from "./components/BotStatus/TradeLog.js";
import { RightSidebar } from "./components/Sidebar/RightSidebar.js";
import { TokenTicker } from "./components/TokenTicker.js";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useFavorites } from "./hooks/useFavorites.js";
import { AuthProvider, useAuth } from "./hooks/useAuth.js";
import type { TraderSummary, BotConfig, LeaderboardResponse } from "../../shared/types.js";

const queryClient = new QueryClient();

function Dashboard() {
  const { connected, botStatus, trades, isSwitching } = useWebSocket();
  const { favoriteTraders, isFavorite, toggleFavorite, refreshFavorites } = useFavorites();
  const { user, isAuthenticated, logout } = useAuth();
  const qc = useQueryClient();
  const [selectedTrader, setSelectedTrader] = useState<TraderSummary | null>(null);
  const [copyConfig, setCopyConfig] = useState<Partial<BotConfig> | null>(null);
  const [logVisible, setLogVisible] = useState(false);

  const handleToggleLog = useCallback(() => setLogVisible((v) => !v), []);
  const handleCloseTrader = useCallback(() => setSelectedTrader(null), []);
  const handleCloseCopyConfig = useCallback(() => setCopyConfig(null), []);
  const handleCopy = useCallback((config: Partial<BotConfig>) => {
    setCopyConfig(config);
    setSelectedTrader(null);
  }, []);

  const handleViewTrader = useCallback((address: string) => {
    // Try to find full TraderSummary from leaderboard cache
    const pages = qc.getQueriesData<{ pages: LeaderboardResponse[] }>({ queryKey: ["leaderboard"] });
    for (const [, data] of pages) {
      const match = data?.pages?.flatMap((p) => p.traders).find(
        (t) => t.address.toLowerCase() === address.toLowerCase()
      );
      if (match) { setSelectedTrader(match); return; }
    }
    // Fallback: open panel with minimal info — positions/fills still load from API
    setSelectedTrader({
      rank: 0, address, accountValue: 0, displayName: null,
      pnl: { day: 0, week: 0, month: 0, allTime: 0 },
      roi: { day: 0, week: 0, month: 0, allTime: 0 },
      volume: { day: 0, week: 0, month: 0, allTime: 0 },
    });
  }, [qc]);

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Top gradient accent bar */}
      <div className="h-[2px] shrink-0" style={{ background: "linear-gradient(90deg, #00ff41 0%, #00d4ff 50%, #00ff41 100%)" }} />

      {/* Header — slim bar with glass effect */}
      <header className="relative border-b border-border/20 bg-bg-secondary/80 backdrop-blur-sm pl-8 pr-6 py-2 shrink-0 h-9 flex items-center" style={{ boxShadow: "0 1px 12px rgba(0, 0, 0, 0.3)" }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wider">
              <span className="text-green" style={{ textShadow: "0 0 10px rgba(0, 255, 65, 0.4)" }}>HYPER</span>
              <span className="text-amber" style={{ textShadow: "0 0 10px rgba(255, 176, 0, 0.4)" }}> COPY</span>
            </span>
            <span className="text-text-dim text-xs">Pick the best trader. Start copying instantly.</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {isAuthenticated && user && (
              <>
                <span className="text-amber">
                  usr: <span className="text-text">{user.username}</span>
                </span>
                <button
                  onClick={logout}
                  className="text-text-dim hover:text-red transition-colors duration-200"
                >
                  [logout]
                </button>
              </>
            )}
            <span className="text-text-dim">
              <span className="text-green" style={{ textShadow: "0 0 6px rgba(0, 255, 65, 0.3)" }}>SYS</span> ONLINE
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-green ml-1.5 align-middle"
                style={{ boxShadow: "0 0 6px rgba(0, 255, 65, 0.6), 0 0 12px rgba(0, 255, 65, 0.3)" }}
              />
            </span>
            <span className="text-text-dim tabular-nums">
              {new Date().toLocaleDateString("en-US")}
            </span>
          </div>
        </div>
      </header>

      {/* Token price ticker */}
      <TokenTicker />

      {/* Main content area with sidebar */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden flex dashboard-layout">
          {/* Left: Leaderboard */}
          <main className="flex-1 overflow-hidden flex flex-col min-w-0 relative z-[45]">
            <LeaderboardTable
              onSelectTrader={setSelectedTrader}
              selectedAddress={selectedTrader?.address}
              favoriteTraders={favoriteTraders}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              refreshFavorites={refreshFavorites}
            />
          </main>

          {/* Right: Sidebar */}
          <RightSidebar botStatus={botStatus} onViewTrader={handleViewTrader} isSwitching={isSwitching} />
        </div>

        {/* Trade Log */}
        <TradeLog trades={trades} visible={logVisible} onToggle={handleToggleLog} />
      </div>

      {/* Status bar */}
      <StatusPanel status={botStatus} wsConnected={connected} />

      {/* Slide-out panels */}
      {selectedTrader && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleCloseTrader}
          />
          <TraderDetailPanel
            trader={selectedTrader}
            onClose={handleCloseTrader}
            onCopy={isAuthenticated && user?.onboarded ? handleCopy : () => {}}
            activeCopyTarget={botStatus?.running ? botStatus.targetWallet : null}
            isFavorite={isFavorite(selectedTrader.address)}
            onToggleFavorite={() => toggleFavorite(selectedTrader.address, selectedTrader)}
            isAuthenticated={isAuthenticated && !!user?.onboarded}
          />
        </>
      )}

      {/* Copy trader modal */}
      {copyConfig && (
        <CopyTraderForm
          initialConfig={copyConfig}
          onClose={handleCloseCopyConfig}
          isBotRunning={botStatus?.running ?? false}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
