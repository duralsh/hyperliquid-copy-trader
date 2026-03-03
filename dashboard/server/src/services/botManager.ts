import { EventEmitter } from "events";
import type { BotStatus, BotConfig, BotTradeEvent, BotSwitchingEvent } from "../../../shared/types.js";

// These will be lazily imported to avoid loading copy trading deps at module level
let CopyTraderClass: typeof import("../../../../src/copytrading/copyTrader.js").CopyTrader | null = null;
let HLClientClass: typeof import("../../../../src/copytrading/hyperliquidClient.js").HyperliquidClientWrapper | null = null;

async function loadCopyTrading() {
  if (!CopyTraderClass) {
    const mod = await import("../../../../src/copytrading/copyTrader.js");
    CopyTraderClass = mod.CopyTrader;
  }
  if (!HLClientClass) {
    const mod = await import("../../../../src/copytrading/hyperliquidClient.js");
    HLClientClass = mod.HyperliquidClientWrapper;
  }
}

const MAX_TRADE_HISTORY = 100;

class BotManager extends EventEmitter {
  private copyTrader: InstanceType<typeof import("../../../../src/copytrading/copyTrader.js").CopyTrader> | null = null;
  private hlClient: InstanceType<typeof import("../../../../src/copytrading/hyperliquidClient.js").HyperliquidClientWrapper> | null = null;
  private config: BotConfig | null = null;
  private tradeHistory: BotTradeEvent[] = [];
  private startedAt: number | null = null;

  getStatus(): BotStatus {
    if (!this.copyTrader) {
      return {
        running: false,
        targetWallet: null,
        activeTradesCount: 0,
        activeTrades: [],
        wsConnected: false,
        startedAt: null,
        config: null,
      };
    }

    const status = this.copyTrader.getStatus();
    return {
      running: status.running,
      targetWallet: status.targetWallet,
      activeTradesCount: status.activeTradesCount,
      activeTrades: status.activeTrades,
      wsConnected: status.wsConnected,
      startedAt: this.startedAt,
      config: this.config,
    };
  }

  getTradeHistory(): BotTradeEvent[] {
    return this.tradeHistory;
  }

  async start(config: BotConfig): Promise<BotStatus> {
    if (this.copyTrader) {
      // Auto-switch: stop old bot, close positions, start new one
      const oldTarget = this.config?.targetWallet ?? null;
      const switchEvent: BotSwitchingEvent = { from: oldTarget, to: config.targetWallet };
      this.emit("bot:switching", switchEvent);

      this.copyTrader.stop();
      this.copyTrader.removeAllListeners();
      this.copyTrader = null;
      this.hlClient = null;
      this.startedAt = null;

      // Close all open positions before switching
      const { closeAllPositions } = await import("./accountService.js");
      await closeAllPositions();
    }

    return this._startFresh(config);
  }

  private async _startFresh(config: BotConfig): Promise<BotStatus> {
    await loadCopyTrading();

    // Set env vars for the copy trading config
    process.env.COPY_TRADING_TARGET_WALLET = config.targetWallet;
    process.env.SIZE_MULTIPLIER = String(config.sizeMultiplier);
    process.env.MAX_LEVERAGE = String(config.maxLeverage);
    process.env.MAX_POSITION_SIZE_PERCENT = String(config.maxPositionSizePercent);
    process.env.BLOCKED_ASSETS = config.blockedAssets.join(",");
    process.env.DRY_RUN = String(config.dryRun);

    this.hlClient = new HLClientClass!();
    await this.hlClient.initialize();

    this.copyTrader = new CopyTraderClass!(this.hlClient, config.targetWallet);
    this.config = config;
    this.tradeHistory = [];

    // Forward events
    this.copyTrader.on("trade", (data: Record<string, unknown>) => {
      const event: BotTradeEvent = {
        type: "trade",
        timestamp: (data.timestamp as number) ?? Date.now(),
        coin: (data.fill as Record<string, unknown>)?.coin as string,
        action: data.action as string,
        side: (data.params as Record<string, unknown>)?.side as string,
        size: (data.params as Record<string, unknown>)?.size as string,
        price: (data.fill as Record<string, unknown>)?.px as string,
        orderId: (data.result as Record<string, unknown>)?.orderId as string,
        success: true,
      };
      this.addTradeEvent(event);
      this.emit("bot:trade", event);
      this.emit("bot:status", this.getStatus());
    });

    this.copyTrader.on("error", (data: Record<string, unknown>) => {
      const event: BotTradeEvent = {
        type: "error",
        timestamp: (data.timestamp as number) ?? Date.now(),
        coin: (data.fill as Record<string, unknown>)?.coin as string,
        error: data.error as string,
        success: false,
      };
      this.addTradeEvent(event);
      this.emit("bot:error", event);
    });

    this.copyTrader.on("status", () => {
      this.emit("bot:status", this.getStatus());
    });

    await this.copyTrader.start();
    this.startedAt = Date.now();
    const status = this.getStatus();
    this.emit("bot:status", status);
    return status;
  }

  async stop(): Promise<BotStatus> {
    if (!this.copyTrader) {
      throw new Error("Bot is not running.");
    }

    this.copyTrader.stop();
    this.copyTrader.removeAllListeners();
    this.copyTrader = null;
    this.hlClient = null;
    this.startedAt = null;

    const status = this.getStatus();
    this.emit("bot:status", status);
    return status;
  }

  private addTradeEvent(event: BotTradeEvent) {
    this.tradeHistory.push(event);
    if (this.tradeHistory.length > MAX_TRADE_HISTORY) {
      this.tradeHistory.shift();
    }
  }
}

export const botManager = new BotManager();
