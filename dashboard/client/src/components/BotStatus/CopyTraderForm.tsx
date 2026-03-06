import { useState } from "react";
import { useStartBot } from "../../hooks/useBotStatus.js";
import type { BotConfig } from "../../../../shared/types.js";

interface Props {
  initialConfig: Partial<BotConfig>;
  onClose: () => void;
  isBotRunning?: boolean;
}

function Label({ text, hint }: { text: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1">
      <label className="flex items-center gap-1.5 text-text-dim text-xs tracking-wider">
        {text}
        <span
          onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
          className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[9px] cursor-pointer transition-all duration-200 font-bold ${
            open ? "border-amber text-amber shadow-[0_0_6px_rgba(255,176,0,0.3)]" : "border-text-dim/40 text-text-dim hover:border-amber hover:text-amber hover:shadow-[0_0_6px_rgba(255,176,0,0.2)]"
          }`}
        >
          ?
        </span>
      </label>
      {open && (
        <div
          className="mt-1 text-[10px] text-text-dim/80 leading-relaxed bg-bg/70 border border-border/50 rounded-lg px-2.5 py-1.5"
          style={{ borderLeft: "2px solid rgba(255,176,0,0.4)" }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function CopyTraderForm({ initialConfig, onClose, isBotRunning }: Props) {
  const [targetWallet, setTargetWallet] = useState(initialConfig.targetWallet ?? "");
  const [sizeMultiplier, setSizeMultiplier] = useState(String(initialConfig.sizeMultiplier ?? 1.0));
  const [maxLeverage, setMaxLeverage] = useState(String(initialConfig.maxLeverage ?? 40));
  const [maxPositionSizePercent, setMaxPositionSizePercent] = useState(String(initialConfig.maxPositionSizePercent ?? 100));
  const [blockedAssets, setBlockedAssets] = useState("");
  const [dryRun, setDryRun] = useState(initialConfig.dryRun ?? false);
  const startBot = useStartBot();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: BotConfig = {
      targetWallet,
      sizeMultiplier: parseFloat(sizeMultiplier) || 1.0,
      maxLeverage: parseInt(maxLeverage) || 40,
      maxPositionSizePercent: parseInt(maxPositionSizePercent) || 100,
      blockedAssets: blockedAssets
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      dryRun,
    };
    startBot.mutate(config, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60]"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary rounded-lg w-[480px] max-h-[90vh] overflow-auto"
        style={{
          border: "1px solid transparent",
          borderImage: "linear-gradient(180deg, #00ff4150, #00ff4120, #1e2a35) 1",
          boxShadow: "0 0 40px rgba(0,255,65,0.08), 0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,255,65,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-4 border-b border-border"
          style={{ background: "linear-gradient(180deg, rgba(0,255,65,0.03) 0%, transparent 100%)" }}
        >
          <div className="text-green text-sm">
            <span style={{ textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>{">"}</span> configure_copy_bot<span className="cursor-blink">█</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label text="TARGET_WALLET" hint="The wallet address to copy trade. All new positions opened by this trader will be mirrored on your account." />
            <input
              type="text"
              value={targetWallet}
              onChange={(e) => setTargetWallet(e.target.value)}
              placeholder="0x..."
              required
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs font-mono focus:border-green focus:outline-none transition-all duration-200 shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.3),0_0_8px_rgba(0,255,65,0.15)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label text="SIZE_MULTIPLIER" hint="Scales the copied position size relative to the target. 1.0 = same size, 0.5 = half size, 2.0 = double. Adjust based on your account size vs theirs." />
              <input
                type="number"
                step="0.1"
                value={sizeMultiplier}
                onChange={(e) => setSizeMultiplier(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none transition-all duration-200 shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.3),0_0_8px_rgba(0,255,65,0.15)]"
              />
            </div>
            <div>
              <Label text="MAX_LEVERAGE" hint="Upper limit on leverage for copied positions. If the target opens a 50x position and your max is 20, it will be capped at 20x." />
              <input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none transition-all duration-200 shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.3),0_0_8px_rgba(0,255,65,0.15)]"
              />
            </div>
          </div>

          <div>
            <Label text="MAX_POSITION_SIZE_PERCENT" hint="Maximum percentage of your account value that a single copied position can use. 50 = no single position can exceed 50% of your equity. Prevents overconcentration." />
            <input
              type="number"
              value={maxPositionSizePercent}
              onChange={(e) => setMaxPositionSizePercent(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none transition-all duration-200 shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.3),0_0_8px_rgba(0,255,65,0.15)]"
            />
          </div>

          <div>
            <Label text="BLOCKED_ASSETS" hint="Comma-separated list of coins to ignore. The bot will skip any trades the target makes in these assets. Useful to avoid volatile memecoins." />
            <input
              type="text"
              value={blockedAssets}
              onChange={(e) => setBlockedAssets(e.target.value)}
              placeholder="BTC, ETH"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none transition-all duration-200 shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.3),0_0_8px_rgba(0,255,65,0.15)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="accent-green w-4 h-4 cursor-pointer"
            />
            <Label text="DRY_RUN" hint="When enabled, the bot logs all trade decisions but does not execute any orders. Use this to test your configuration safely before going live." />
          </div>

          {startBot.error && (
            <div
              className="text-red text-xs border border-red/30 rounded-lg p-2.5 bg-red/5"
              style={{ borderLeft: "3px solid rgba(255,0,64,0.6)" }}
            >
              ERR: {(startBot.error as Error).message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={startBot.isPending || !targetWallet}
              className="flex-1 py-2.5 bg-green/10 border border-green text-green hover:bg-green/20 transition-all duration-200 text-sm rounded disabled:opacity-50 shadow-[0_0_12px_rgba(0,255,65,0.1),inset_0_1px_0_rgba(0,255,65,0.1)] hover:shadow-[0_0_20px_rgba(0,255,65,0.2),inset_0_1px_0_rgba(0,255,65,0.15)]"
            >
              {startBot.isPending
                ? isBotRunning
                  ? "> switching... closing positions..."
                  : "> starting..."
                : isBotRunning
                  ? "> SWITCH BOT"
                  : "> START BOT"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-border text-text-dim hover:text-text hover:border-text transition-all duration-200 text-sm rounded hover:bg-white/[0.03]"
            >
              [cancel]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
