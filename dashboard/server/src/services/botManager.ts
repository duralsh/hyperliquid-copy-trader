import { EventEmitter } from "events";
import type { BotStatus, BotConfig, BotTradeEvent, BotSwitchingEvent } from "../../../shared/types.js";
import type { UserContext } from "./userContext.js";
import { insertFollowEvent } from "./followEventService.js";

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

interface BotInstance {
  copyTrader: InstanceType<typeof import("../../../../src/copytrading/copyTrader.js").CopyTrader>;
  hlClient: InstanceType<typeof import("../../../../src/copytrading/hyperliquidClient.js").HyperliquidClientWrapper>;
  config: BotConfig;
  tradeHistory: BotTradeEvent[];
  startedAt: number;
}

class BotManager extends EventEmitter {
  private instances = new Map<number, BotInstance>();

  getStatus(userId?: number): BotStatus {
    if (userId === undefined) {
      // Legacy: return first instance status or stopped
      const first = this.instances.values().next().value as BotInstance | undefined;
      if (!first) return this._emptyStatus();
      return this._instanceStatus(first);
    }
    const instance = this.instances.get(userId);
    if (!instance) return this._emptyStatus();
    return this._instanceStatus(instance);
  }

  getTradeHistory(userId?: number): BotTradeEvent[] {
    if (userId === undefined) {
      const first = this.instances.values().next().value as BotInstance | undefined;
      return first?.tradeHistory ?? [];
    }
    return this.instances.get(userId)?.tradeHistory ?? [];
  }

  async start(config: BotConfig, userId?: number, ctx?: UserContext): Promise<BotStatus> {
    const uid = userId ?? 0;
    const existing = this.instances.get(uid);

    if (existing) {
      const oldTarget = existing.config.targetWallet;
      const switchEvent: BotSwitchingEvent = { from: oldTarget, to: config.targetWallet };
      this.emit("bot:switching", { userId: uid, ...switchEvent });

      insertFollowEvent(uid, "switched", config.targetWallet, oldTarget);

      existing.copyTrader.stop();
      existing.copyTrader.removeAllListeners();
      this.instances.delete(uid);

      // Close all open positions before switching
      const { closeAllPositions } = await import("./accountService.js");
      await closeAllPositions(ctx?.walletAddress, ctx?.arenaApiKey);
    } else {
      insertFollowEvent(uid, "started", config.targetWallet);
    }

    return this._startFresh(config, uid, ctx);
  }

  private async _startFresh(config: BotConfig, userId: number, ctx?: UserContext): Promise<BotStatus> {
    await loadCopyTrading();

    // Set env vars for the copy trading config
    process.env.COPY_TRADING_TARGET_WALLET = config.targetWallet;
    process.env.SIZE_MULTIPLIER = String(config.sizeMultiplier);
    process.env.MAX_LEVERAGE = String(config.maxLeverage);
    process.env.MAX_POSITION_SIZE_PERCENT = String(config.maxPositionSizePercent);
    process.env.BLOCKED_ASSETS = config.blockedAssets.join(",");
    process.env.DRY_RUN = String(config.dryRun);

    // If user context provided, override wallet credentials
    if (ctx) {
      process.env.MAIN_WALLET_PRIVATE_KEY = ctx.privateKey;
      process.env.MAIN_WALLET_ADDRESS = ctx.walletAddress;
      process.env.ARENA_API_KEY = ctx.arenaApiKey;
    }

    const hlClient = new HLClientClass!();
    await hlClient.initialize();

    const copyTrader = new CopyTraderClass!(hlClient, config.targetWallet);
    const tradeHistory: BotTradeEvent[] = [];

    const instance: BotInstance = {
      copyTrader,
      hlClient,
      config,
      tradeHistory,
      startedAt: Date.now(),
    };

    this.instances.set(userId, instance);

    // Forward events
    const nested = (obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined =>
      obj[key] as Record<string, unknown> | undefined;

    copyTrader.on("trade", (data: Record<string, unknown>) => {
      const fill = nested(data, "fill");
      const params = nested(data, "params");
      const result = nested(data, "result");
      const event: BotTradeEvent = {
        type: "trade",
        timestamp: (data.timestamp as number) ?? Date.now(),
        coin: fill?.coin as string,
        action: data.action as string,
        side: params?.side as string,
        size: params?.size as string,
        price: fill?.px as string,
        orderId: result?.orderId as string,
        success: true,
      };
      this._addTradeEvent(instance, event);
      this.emit("bot:trade", { userId, ...event });
      this.emit("bot:status", { userId, ...this.getStatus(userId) });
    });

    copyTrader.on("error", (data: Record<string, unknown>) => {
      const fill = nested(data, "fill");
      const event: BotTradeEvent = {
        type: "error",
        timestamp: (data.timestamp as number) ?? Date.now(),
        coin: fill?.coin as string,
        error: data.error as string,
        success: false,
      };
      this._addTradeEvent(instance, event);
      this.emit("bot:error", { userId, ...event });
    });

    copyTrader.on("status", () => {
      this.emit("bot:status", { userId, ...this.getStatus(userId) });
    });

    await copyTrader.start();
    const status = this.getStatus(userId);
    this.emit("bot:status", { userId, ...status });
    return status;
  }

  async stop(userId?: number): Promise<BotStatus> {
    const uid = userId ?? 0;
    const instance = this.instances.get(uid);
    if (!instance) {
      throw new Error("Bot is not running.");
    }

    insertFollowEvent(uid, "stopped", instance.config.targetWallet);
    instance.copyTrader.stop();
    instance.copyTrader.removeAllListeners();
    this.instances.delete(uid);

    const status = this._emptyStatus();
    this.emit("bot:status", { userId: uid, ...status });
    return status;
  }

  private _emptyStatus(): BotStatus {
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

  private _instanceStatus(instance: BotInstance): BotStatus {
    const status = instance.copyTrader.getStatus();
    return {
      running: status.running,
      targetWallet: status.targetWallet,
      activeTradesCount: status.activeTradesCount,
      activeTrades: status.activeTrades,
      wsConnected: status.wsConnected,
      startedAt: instance.startedAt,
      config: instance.config,
    };
  }

  private _addTradeEvent(instance: BotInstance, event: BotTradeEvent) {
    instance.tradeHistory.push(event);
    if (instance.tradeHistory.length > MAX_TRADE_HISTORY) {
      instance.tradeHistory.shift();
    }
  }
}

export const botManager = new BotManager();
