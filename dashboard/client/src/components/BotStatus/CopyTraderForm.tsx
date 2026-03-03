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
      <label className="flex items-center gap-1.5 text-text-dim text-xs">
        {text}
        <span
          onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[9px] cursor-pointer transition-colors ${
            open ? "border-amber text-amber" : "border-text-dim/40 text-text-dim hover:border-amber hover:text-amber"
          }`}
        >
          ?
        </span>
      </label>
      {open && (
        <div className="mt-1 text-[10px] text-text-dim/80 leading-relaxed bg-bg/50 border border-border/50 rounded px-2 py-1">
          {hint}
        </div>
      )}
    </div>
  );
}

export function CopyTraderForm({ initialConfig, onClose, isBotRunning }: Props) {
  const [targetWallet, setTargetWallet] = useState(initialConfig.targetWallet ?? "");
  const [sizeMultiplier, setSizeMultiplier] = useState(String(initialConfig.sizeMultiplier ?? 1.0));
  const [maxLeverage, setMaxLeverage] = useState(String(initialConfig.maxLeverage ?? 20));
  const [maxPositionSizePercent, setMaxPositionSizePercent] = useState(String(initialConfig.maxPositionSizePercent ?? 50));
  const [blockedAssets, setBlockedAssets] = useState("");
  const [dryRun, setDryRun] = useState(initialConfig.dryRun ?? false);
  const startBot = useStartBot();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: BotConfig = {
      targetWallet,
      sizeMultiplier: parseFloat(sizeMultiplier) || 1.0,
      maxLeverage: parseInt(maxLeverage) || 20,
      maxPositionSizePercent: parseInt(maxPositionSizePercent) || 50,
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-green/30 rounded-lg w-[480px] max-h-[90vh] overflow-auto shadow-2xl shadow-green/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <div className="text-green text-sm">
            {">"} configure_copy_bot<span className="cursor-blink">█</span>
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
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs font-mono focus:border-green focus:outline-none"
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
                className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none"
              />
            </div>
            <div>
              <Label text="MAX_LEVERAGE" hint="Upper limit on leverage for copied positions. If the target opens a 50x position and your max is 20, it will be capped at 20x." />
              <input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none"
              />
            </div>
          </div>

          <div>
            <Label text="MAX_POSITION_SIZE_PERCENT" hint="Maximum percentage of your account value that a single copied position can use. 50 = no single position can exceed 50% of your equity. Prevents overconcentration." />
            <input
              type="number"
              value={maxPositionSizePercent}
              onChange={(e) => setMaxPositionSizePercent(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none"
            />
          </div>

          <div>
            <Label text="BLOCKED_ASSETS" hint="Comma-separated list of coins to ignore. The bot will skip any trades the target makes in these assets. Useful to avoid volatile memecoins." />
            <input
              type="text"
              value={blockedAssets}
              onChange={(e) => setBlockedAssets(e.target.value)}
              placeholder="BTC, ETH"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-xs focus:border-green focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="accent-green"
            />
            <Label text="DRY_RUN" hint="When enabled, the bot logs all trade decisions but does not execute any orders. Use this to test your configuration safely before going live." />
          </div>

          {startBot.error && (
            <div className="text-red text-xs border border-red/30 rounded p-2 bg-red/5">
              ERR: {(startBot.error as Error).message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={startBot.isPending || !targetWallet}
              className="flex-1 py-2 bg-green/10 border border-green text-green hover:bg-green/20 transition-colors text-sm rounded disabled:opacity-50"
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
              className="px-4 py-2 border border-border text-text-dim hover:text-text hover:border-text transition-colors text-sm rounded"
            >
              [cancel]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
