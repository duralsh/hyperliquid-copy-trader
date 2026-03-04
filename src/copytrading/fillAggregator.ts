import { logger } from "./logger.js";
import { ErrorHandler } from "./utils/errors.js";
import type { FillEvent } from "./types.js";

const AGGREGATION_DELAY_MS = 150;

interface FillGroup {
  fills: FillEvent[];
  timer: ReturnType<typeof setTimeout>;
}

export class FillAggregator {
  private buffer: Map<string, FillGroup> = new Map();
  private onAggregated: (fill: FillEvent) => void;

  constructor(onAggregated: (fill: FillEvent) => void) {
    this.onAggregated = onAggregated;
  }

  add(fill: FillEvent): void {
    const key = fill.hash;
    const group = this.buffer.get(key);

    if (group) {
      clearTimeout(group.timer);
      group.fills.push(fill);
      group.timer = setTimeout(() => this.flush(key), AGGREGATION_DELAY_MS);
    } else {
      const timer = setTimeout(() => this.flush(key), AGGREGATION_DELAY_MS);
      this.buffer.set(key, { fills: [fill], timer });
    }
  }

  private flush(key: string): void {
    const group = this.buffer.get(key);
    if (!group) return;
    this.buffer.delete(key);
    const merged = this.mergeFills(group.fills);
    try {
      this.onAggregated(merged);
    } catch (error: unknown) {
      logger.error("Error in aggregated fill handler", ErrorHandler.formatError(error));
    }
  }

  flushAll(): void {
    for (const [key, group] of this.buffer) {
      clearTimeout(group.timer);
      const merged = this.mergeFills(group.fills);
      try {
        this.onAggregated(merged);
      } catch (error: unknown) {
        logger.error("Error in aggregated fill handler", ErrorHandler.formatError(error));
      }
    }
    this.buffer.clear();
  }

  destroy(): void {
    for (const [, group] of this.buffer) {
      clearTimeout(group.timer);
    }
    this.buffer.clear();
  }

  private mergeFills(fills: FillEvent[]): FillEvent {
    if (fills.length === 1) return fills[0];

    const first = fills[0];
    let totalSize = 0;
    let totalNotional = 0;
    let totalClosedPnl = 0;
    let totalFee = 0;
    let maxTime = 0;

    for (const f of fills) {
      const sz = parseFloat(f.sz);
      const px = parseFloat(f.px);
      totalSize += sz;
      totalNotional += sz * px;
      totalClosedPnl += parseFloat(f.closedPnl);
      totalFee += parseFloat(f.fee);
      if (f.time > maxTime) maxTime = f.time;
    }

    const vwap = totalSize > 0 ? totalNotional / totalSize : parseFloat(first.px);

    logger.info("Aggregated fills", {
      hash: first.hash,
      fillCount: fills.length,
      totalSize,
      vwap,
      coin: first.coin,
    });

    return {
      ...first,
      sz: totalSize.toString(),
      px: vwap.toString(),
      closedPnl: totalClosedPnl.toString(),
      fee: totalFee.toString(),
      time: maxTime,
    };
  }
}
