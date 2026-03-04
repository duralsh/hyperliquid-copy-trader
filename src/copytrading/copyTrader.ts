import { EventEmitter } from "events";
import { copyTradingConfig } from "./config.js";
import { logger, loggerUtils } from "./logger.js";
import { HyperliquidClientWrapper } from "./hyperliquidClient.js";
import {
  calculatePositionSize,
  capLeverage,
  getTradeAction,
  removeTrailingZeros,
  validateTradeParams,
} from "./utils/risk.js";
import {
  TradingError,
  ValidationError,
  ErrorHandler,
  retryWithBackoff,
} from "./utils/errors.js";
import { sendErrorNotification } from "./notifications/arenaFeed.js";
import type {
  CopyTradeParams,
  FillEvent,
  Position,
  TradeResult,
} from "./types.js";

const PNL_SETTLE_DELAY_MS = 2_000;
const PNL_TIME_WINDOW_MS = 30_000;
const RETRY_OPTS = { maxRetries: 3, initialDelay: 1_000, maxDelay: 10_000, backoffMultiplier: 2 } as const;

export interface CopyTraderStatus {
  running: boolean;
  targetWallet: string;
  activeTradesCount: number;
  activeTrades: string[];
  wsConnected: boolean;
  startedAt: number | null;
}

export class CopyTrader extends EventEmitter {
  private client: HyperliquidClientWrapper;
  private targetWallet: string;
  private ourAddress: string;
  private activeTrades: Set<string> = new Set();
  private unsubscribeFn?: () => void;
  private running = false;
  private startedAt: number | null = null;

  constructor(client: HyperliquidClientWrapper, targetWallet: string) {
    super();
    this.client = client;
    this.targetWallet = targetWallet;
    this.ourAddress = client.getAddress();
  }

  async start(): Promise<void> {
    logger.info("Starting copy trader", {
      ourAddress: this.ourAddress,
      targetWallet: this.targetWallet,
      dryRun: copyTradingConfig.DRY_RUN,
    });

    this.unsubscribeFn = await this.client.subscribeToUserFills(
      this.targetWallet,
      (fill: FillEvent) => this.handleFill(fill)
    );

    this.running = true;
    this.startedAt = Date.now();
    this.emit("status", this.getStatus());
    logger.info("Copy trader started, monitoring fills...");
  }

  stop(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = undefined;
    }
    this.running = false;
    this.startedAt = null;
    this.emit("status", this.getStatus());
    logger.info("Copy trader stopped");
  }

  getStatus(): CopyTraderStatus {
    return {
      running: this.running,
      targetWallet: this.targetWallet,
      activeTradesCount: this.activeTrades.size,
      activeTrades: [...this.activeTrades],
      wsConnected: this.client.isWsConnected(),
      startedAt: this.startedAt,
    };
  }

  private async handleFill(fill: FillEvent): Promise<void> {
    try {
      logger.info("Received fill event", {
        coin: fill.coin,
        side: fill.side,
        size: fill.sz,
        price: fill.px,
        direction: fill.dir,
        hash: fill.hash,
      });

      const action = getTradeAction(fill);
      logger.info("Trade action determined", { action, fill });
      this.emit("fill", { fill, action });

      let ourEquityData: { accountValue: string };
      let targetEquityData: { accountValue: string };
      try {
        [ourEquityData, targetEquityData] = await retryWithBackoff(
          async () => {
            return await Promise.all([
              this.client.getAccountEquity(this.ourAddress),
              this.client.getAccountEquity(this.targetWallet),
            ]);
          },
          RETRY_OPTS,
          (error, attempt) => {
            logger.warn(`Failed to fetch account equity (attempt ${attempt}/3)`, { error });
          }
        );
      } catch (error: unknown) {
        const formattedError = ErrorHandler.formatError(error);
        logger.error("Failed to fetch account equity after retries", formattedError);
        await sendErrorNotification(
          ErrorHandler.wrapError(error, "Failed to fetch account equity"),
          { fillHash: fill.hash, coin: fill.coin }
        );
        return;
      }

      const ourEquity = parseFloat(ourEquityData.accountValue);
      const targetEquity = parseFloat(targetEquityData.accountValue);

      if (isNaN(ourEquity) || isNaN(targetEquity)) {
        throw new ValidationError("Invalid equity values", {
          ourEquity: ourEquityData.accountValue,
          targetEquity: targetEquityData.accountValue,
        });
      }

      logger.info("Account equities", { ourEquity, targetEquity });

      let targetPositions: Position[];
      try {
        [, targetPositions] = await retryWithBackoff(
          async () => {
            return await Promise.all([
              this.client.getPositions(this.ourAddress),
              this.client.getPositions(this.targetWallet),
            ]);
          },
          RETRY_OPTS,
        );
      } catch (error: unknown) {
        const formattedError = ErrorHandler.formatError(error);
        logger.error("Failed to fetch positions after retries", formattedError);
        await sendErrorNotification(
          ErrorHandler.wrapError(error, "Failed to fetch positions"),
          { fillHash: fill.hash, coin: fill.coin }
        );
        return;
      }

      const targetPosition = targetPositions.find((p) => p.coin === fill.coin);

      let tradeParams: CopyTradeParams | null;
      try {
        tradeParams = await this.calculateTradeParams(
          fill,
          action,
          ourEquity,
          targetEquity,
          targetPosition
        );
      } catch (error: unknown) {
        const formattedError = ErrorHandler.formatError(error);
        logger.error("Failed to calculate trade parameters", formattedError);
        await sendErrorNotification(
          ErrorHandler.wrapError(error, "Failed to calculate trade parameters"),
          { fillHash: fill.hash, coin: fill.coin }
        );
        return;
      }

      if (!tradeParams) {
        logger.warn("Trade parameters calculation returned null, skipping", {
          coin: fill.coin,
          action,
        });
        return;
      }

      const result = await this.executeTrade(tradeParams, fill.px, ourEquity);

      if (!result.success) {
        loggerUtils.logTrade("error", "Trade execution failed", {
          error: result.error,
          params: tradeParams,
          fillHash: fill.hash,
          coin: fill.coin,
        });
        this.emit("error", { error: result.error, fill, params: tradeParams, timestamp: Date.now() });
        await sendErrorNotification(
          new TradingError(result.error || "Trade execution failed", false, {
            tradeParams,
            fillHash: fill.hash,
          }),
          {}
        );
        return;
      }

      loggerUtils.logTrade("info", "Trade executed successfully", {
        orderId: result.orderId,
        params: tradeParams,
        fillHash: fill.hash,
        coin: fill.coin,
        action,
      });

      if (action === "open") {
        this.activeTrades.add(fill.coin);
      } else if (action === "close") {
        this.activeTrades.delete(fill.coin);
      }

      this.emit("trade", { fill, params: tradeParams, result, action, timestamp: Date.now() });
      this.emit("status", this.getStatus());

      // For close trades, fetch our own wallet's PnL instead of using the target's.
      // Wait for the fill to settle on Hyperliquid before querying.
      const ourClosedPnl = action === "close"
        ? await this.fetchOurClosedPnl(fill)
        : undefined;

      await this.sendNotification(fill, tradeParams, result, ourClosedPnl);
    } catch (error: unknown) {
      const formattedError = ErrorHandler.formatError(error);
      logger.error("Error handling fill", { fill, ...formattedError });
      this.emit("error", { error: formattedError.message, fill, timestamp: Date.now() });

      if (error instanceof TradingError || error instanceof ValidationError) {
        await sendErrorNotification(
          ErrorHandler.wrapError(error, "Error handling fill"),
          { fillHash: fill.hash, coin: fill.coin }
        );
      }
    }
  }

  private async calculateTradeParams(
    fill: FillEvent,
    action: "open" | "reduce" | "close",
    ourEquity: number,
    targetEquity: number,
    targetPosition: Position | undefined
  ): Promise<CopyTradeParams | null> {
    const coin = fill.coin;

    // Guard: check concurrent trade limit early
    if (action === "open" && this.activeTrades.size >= copyTradingConfig.MAX_CONCURRENT_TRADES) {
      logger.warn("Max concurrent trades reached, skipping", {
        activeTrades: this.activeTrades.size,
        max: copyTradingConfig.MAX_CONCURRENT_TRADES,
        coin,
      });
      return null;
    }

    const fillSize = parseFloat(fill.sz);
    const reduceOnly = action !== "open";

    let side: "A" | "B";
    if (action === "open") {
      side = fill.dir === "Open Long" ? "B" : "A";
    } else if (targetPosition) {
      const isLong = parseFloat(targetPosition.szi) > 0;
      side = isLong ? "A" : "B";
    } else {
      side = fill.side;
    }

    const leverage = targetPosition?.leverage
      ? capLeverage(parseInt(targetPosition.leverage.value, 10))
      : 1;

    const fillPrice = parseFloat(fill.px);
    const calculatedSize = calculatePositionSize(fillSize, ourEquity, targetEquity, fillPrice, leverage);

    if (calculatedSize <= 0 || isNaN(calculatedSize) || !isFinite(calculatedSize)) {
      logger.error("Invalid calculated position size", {
        calculatedSize,
        targetSize: fillSize,
        ourEquity,
        targetEquity,
        coin,
      });
      return null;
    }

    return {
      coin,
      side,
      size: removeTrailingZeros(calculatedSize.toFixed(8)),
      orderType: "Market",
      reduceOnly,
      leverage,
    };
  }

  private async executeTrade(
    params: CopyTradeParams,
    price: string,
    ourEquity: number
  ): Promise<TradeResult> {
    // Skip margin validation for reduce/close — they reduce risk, not add it
    if (!params.reduceOnly) {
      const validation = validateTradeParams(params, price, ourEquity);
      if (!validation.valid) {
        const error = new ValidationError(validation.reason || "Invalid trade parameters", {
          params,
          price,
          ourEquity,
        });
        logger.warn("Trade validation failed", ErrorHandler.formatError(error));
        return {
          success: false,
          error: error.message,
          params,
        };
      }
    }

    try {
      const orderId = await retryWithBackoff(
        async () => {
          return await this.client.placeOrder({
            coin: params.coin,
            side: params.side,
            sz: params.size,
            orderType: params.orderType,
            reduceOnly: params.reduceOnly,
            leverage: params.leverage,
          });
        },
        RETRY_OPTS,
        (error, attempt) => {
          logger.warn(`Trade execution attempt ${attempt}/3 failed`, {
            error: ErrorHandler.formatError(error),
            params,
          });
        }
      );

      return {
        success: true,
        orderId,
        params,
      };
    } catch (error: unknown) {
      const formattedError = ErrorHandler.formatError(error);
      logger.error("Trade execution failed after retries", { ...formattedError });

      return {
        success: false,
        error: formattedError.message,
        params,
      };
    }
  }

  private async fetchOurClosedPnl(fill: FillEvent): Promise<string | undefined> {
    try {
      // Delay so the fill is indexed by Hyperliquid's API
      await new Promise((r) => setTimeout(r, PNL_SETTLE_DELAY_MS));

      const ourFills = await retryWithBackoff(
        () => this.client.getUserFills(this.ourAddress),
        { ...RETRY_OPTS, initialDelay: PNL_SETTLE_DELAY_MS }
      );

      // Match by coin AND timestamp (within the time window)
      const now = Date.now();
      const recentCloseFills = ourFills.filter(
        (f) =>
          f.coin === fill.coin &&
          f.dir.startsWith("Close") &&
          now - f.time < PNL_TIME_WINDOW_MS
      );

      if (recentCloseFills.length > 0) {
        const totalPnl = recentCloseFills.reduce(
          (sum, f) => sum + parseFloat(f.closedPnl || "0"),
          0
        );
        const pnl = totalPnl.toFixed(4);
        logger.info("Fetched our wallet's closedPnl", {
          coin: fill.coin,
          ourClosedPnl: pnl,
          matchedFills: recentCloseFills.length,
          targetClosedPnl: fill.closedPnl,
        });
        return pnl;
      }

      logger.warn("Could not find our close fill for PnL within time window", {
        coin: fill.coin,
        totalFills: ourFills.length,
        closeFillsForCoin: ourFills.filter(
          (f) => f.coin === fill.coin && f.dir.startsWith("Close")
        ).length,
      });
      return undefined;
    } catch (error: unknown) {
      logger.warn("Failed to fetch our PnL, falling back to target's", {
        coin: fill.coin,
        error: ErrorHandler.formatError(error),
      });
      return undefined;
    }
  }

  private async sendNotification(
    fill: FillEvent,
    params: CopyTradeParams,
    result: TradeResult,
    ourClosedPnl?: string
  ): Promise<void> {
    if (copyTradingConfig.ARENA_FEED_ENABLED || copyTradingConfig.DRY_RUN) {
      const { sendTradeNotification } = await import("./notifications/arenaFeed.js");
      await sendTradeNotification(fill, params, result, ourClosedPnl);
    }
  }

}
