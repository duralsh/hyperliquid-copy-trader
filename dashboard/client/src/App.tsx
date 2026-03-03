import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeaderboardTable } from "./components/Leaderboard/LeaderboardTable.js";
import { TraderDetailPanel } from "./components/TraderDetail/TraderDetailPanel.js";
import { CopyTraderForm } from "./components/BotStatus/CopyTraderForm.js";
import { StatusPanel } from "./components/BotStatus/StatusPanel.js";
import { TradeLog } from "./components/BotStatus/TradeLog.js";
import { RightSidebar } from "./components/Sidebar/RightSidebar.js";
import { TokenTicker } from "./components/TokenTicker.js";
import { useWebSocket } from "./hooks/useWebSocket.js";
import type { TraderSummary, BotConfig } from "../../shared/types.js";

const queryClient = new QueryClient();

function Dashboard() {
  const { connected, botStatus, trades } = useWebSocket();
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

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Header — slim 36px bar */}
      <header className="relative border-b border-border/30 bg-bg-secondary px-4 py-2 shrink-0 h-9 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-green text-sm font-bold tracking-wider">HL TRADER</span>
            <span className="text-text-dim text-xs">v2.0</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-text-dim">
              <span className="text-green">SYS</span> ONLINE
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green ml-1.5 align-middle" />
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
            />
          </main>

          {/* Right: Sidebar */}
          <RightSidebar />
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
            onCopy={handleCopy}
          />
        </>
      )}

      {/* Copy trader modal */}
      {copyConfig && (
        <CopyTraderForm
          initialConfig={copyConfig}
          onClose={handleCloseCopyConfig}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

export default App;
