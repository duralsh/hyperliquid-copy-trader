import { copyTradingConfig } from "../config.js";
import { logger } from "../logger.js";
import type { CopyTradeParams, FillEvent } from "../types.js";

export function removeTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

export function isAssetBlocked(coin: string): boolean {
  return copyTradingConfig.BLOCKED_ASSETS.includes(coin.toUpperCase());
}

export function meetsMinimumNotional(size: string, price: string): boolean {
  const notional = parseFloat(size) * parseFloat(price);
  return notional >= copyTradingConfig.MIN_NOTIONAL;
}

export function capLeverage(leverage: number): number {
  return Math.min(leverage, copyTradingConfig.MAX_LEVERAGE);
}

export function capPositionSize(
  calculatedSize: number,
  ourEquity: number,
  price: number,
  leverage: number
): number {
  const safeLeverage = leverage > 0 ? leverage : 1;
  const maxMargin = (ourEquity * copyTradingConfig.MAX_POSITION_SIZE_PERCENT) / 100;
  const maxNotional = maxMargin * safeLeverage;
  const maxCoinQty = price > 0 ? maxNotional / price : calculatedSize;
  return Math.min(calculatedSize, maxCoinQty);
}

export function calculatePositionSize(
  targetSize: number,
  ourEquity: number,
  targetEquity: number,
  price: number,
  leverage: number
): number {
  if (targetEquity === 0) {
    logger.warn("Target equity is zero, using target size directly");
    return targetSize * copyTradingConfig.SIZE_MULTIPLIER;
  }
  const ratio = ourEquity / targetEquity;
  const calculatedSize = ratio * targetSize * copyTradingConfig.SIZE_MULTIPLIER;
  return capPositionSize(calculatedSize, ourEquity, price, leverage);
}

export function calculateCloseSize(
  targetFillSize: number,
  targetStartPosition: number,
  ourPositionSize: number,
): number {
  if (targetStartPosition === 0) return Math.abs(ourPositionSize);
  const closePercent = targetFillSize / Math.abs(targetStartPosition);
  const pct = Math.min(closePercent, 1);
  return pct * Math.abs(ourPositionSize);
}

export function getTradeAction(fill: FillEvent): "open" | "reduce" | "close" {
  if (fill.dir === "Open Long" || fill.dir === "Open Short") return "open";
  if (fill.dir === "Close Long" || fill.dir === "Close Short") {
    const startPos = parseFloat(fill.startPosition);
    const fillSize = parseFloat(fill.sz);
    if (Math.abs(startPos) <= fillSize) return "close";
  }
  return "reduce";
}

export function validateTradeParams(
  params: CopyTradeParams,
  price: string,
  ourEquity: number
): { valid: boolean; reason?: string } {
  if (isAssetBlocked(params.coin)) {
    return { valid: false, reason: `Asset ${params.coin} is blocked` };
  }
  if (!meetsMinimumNotional(params.size, price)) {
    return {
      valid: false,
      reason: `Position size ${params.size} * ${price} < ${copyTradingConfig.MIN_NOTIONAL} minimum`,
    };
  }
  if (params.leverage > copyTradingConfig.MAX_LEVERAGE) {
    return {
      valid: false,
      reason: `Leverage ${params.leverage} exceeds max ${copyTradingConfig.MAX_LEVERAGE}`,
    };
  }
  const positionValue = parseFloat(params.size) * parseFloat(price);
  const leverage = params.leverage > 0 ? params.leverage : 1;
  const marginRequired = positionValue / leverage;
  const maxAllowed = (ourEquity * copyTradingConfig.MAX_POSITION_SIZE_PERCENT) / 100;
  if (marginRequired > maxAllowed) {
    return {
      valid: false,
      reason: `Margin required ${marginRequired.toFixed(2)} exceeds ${maxAllowed.toFixed(2)} max (notional ${positionValue.toFixed(2)} at ${leverage}x)`,
    };
  }
  return { valid: true };
}
