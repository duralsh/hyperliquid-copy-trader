import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FillEvent } from "../types.js";

vi.mock("../logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/errors.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/errors.js")>("../utils/errors.js");
  return { ...actual };
});

import { FillAggregator } from "../fillAggregator.js";

function makeFill(overrides: Partial<FillEvent> = {}): FillEvent {
  return {
    coin: "SOL",
    px: "150",
    sz: "4.0",
    side: "A",
    time: 1000,
    startPosition: "12.34",
    dir: "Close Long",
    closedPnl: "10",
    hash: "0xabc",
    oid: 1,
    crossed: false,
    fee: "0.5",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FillAggregator", () => {
  it("single fill passes through after delay", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    agg.add(makeFill());
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].sz).toBe("4.0");

    agg.destroy();
  });

  it("same-hash fills are merged into one", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    agg.add(makeFill({ sz: "4.0", px: "150", closedPnl: "5", fee: "0.2", time: 1000 }));
    agg.add(makeFill({ sz: "4.0", px: "150", closedPnl: "5", fee: "0.2", time: 1001 }));
    agg.add(makeFill({ sz: "4.34", px: "150", closedPnl: "5", fee: "0.1", time: 1002 }));

    vi.advanceTimersByTime(150);
    expect(handler).toHaveBeenCalledOnce();

    const merged = handler.mock.calls[0][0] as FillEvent;
    expect(parseFloat(merged.sz)).toBeCloseTo(12.34, 6);
    expect(parseFloat(merged.closedPnl)).toBeCloseTo(15, 6);
    expect(parseFloat(merged.fee)).toBeCloseTo(0.5, 6);
    expect(merged.time).toBe(1002);
    // startPosition preserved from first fill
    expect(merged.startPosition).toBe("12.34");

    agg.destroy();
  });

  it("different hashes are isolated", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    agg.add(makeFill({ hash: "0x111", sz: "1.0" }));
    agg.add(makeFill({ hash: "0x222", sz: "2.0" }));

    vi.advanceTimersByTime(150);
    expect(handler).toHaveBeenCalledTimes(2);

    const sizes = handler.mock.calls.map((c: any) => c[0].sz);
    expect(sizes).toContain("1.0");
    expect(sizes).toContain("2.0");

    agg.destroy();
  });

  it("debounce resets on new fill with same hash", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    agg.add(makeFill({ hash: "0xaaa", sz: "1.0" }));
    vi.advanceTimersByTime(100); // 100ms, not yet flushed
    expect(handler).not.toHaveBeenCalled();

    agg.add(makeFill({ hash: "0xaaa", sz: "2.0" })); // resets timer
    vi.advanceTimersByTime(100); // 200ms total, but only 100ms since last add
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50); // 150ms since last add
    expect(handler).toHaveBeenCalledOnce();
    expect(parseFloat(handler.mock.calls[0][0].sz)).toBeCloseTo(3.0, 6);

    agg.destroy();
  });

  it("VWAP price calculation", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    // 2.0 @ $100 + 3.0 @ $200 = VWAP = (200+600)/5 = 160
    agg.add(makeFill({ sz: "2.0", px: "100" }));
    agg.add(makeFill({ sz: "3.0", px: "200" }));

    vi.advanceTimersByTime(150);
    const merged = handler.mock.calls[0][0] as FillEvent;
    expect(parseFloat(merged.px)).toBeCloseTo(160, 6);

    agg.destroy();
  });

  it("flushAll processes all pending groups immediately", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    agg.add(makeFill({ hash: "0x111", sz: "1.0" }));
    agg.add(makeFill({ hash: "0x222", sz: "2.0" }));
    expect(handler).not.toHaveBeenCalled();

    agg.flushAll();
    expect(handler).toHaveBeenCalledTimes(2);

    agg.destroy();
  });

  it("destroy clears timers without flushing", () => {
    const handler = vi.fn();
    const agg = new FillAggregator(handler);

    agg.add(makeFill());
    agg.destroy();

    vi.advanceTimersByTime(500);
    expect(handler).not.toHaveBeenCalled();
  });
});
