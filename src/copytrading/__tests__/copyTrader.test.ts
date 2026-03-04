import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FillEvent, Position, CopyTradeParams } from "../types.js";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables are available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    BLOCKED_ASSETS: [] as string[],
    MIN_NOTIONAL: 10,
    MAX_LEVERAGE: 40,
    MAX_POSITION_SIZE_PERCENT: 100,
    SIZE_MULTIPLIER: 1,
    MAX_CONCURRENT_TRADES: 10,
    DRY_RUN: false,
    ARENA_FEED_ENABLED: false,
    TARGET_WALLET: "0xTARGET",
    PRIVATE_KEY: "0xKEY",
    TESTNET: false,
    LOG_LEVEL: "error",
    COPY_TRADING_TARGET_WALLET: "0xTARGET",
  },
}));

vi.mock("../config.js", () => ({ copyTradingConfig: mockConfig }));

vi.mock("../logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  loggerUtils: {
    logTrade: vi.fn(),
    logPerformance: vi.fn(),
    logWebSocket: vi.fn(),
  },
}));

vi.mock("../notifications/arenaFeed.js", () => ({
  sendTradeNotification: vi.fn(),
  sendErrorNotification: vi.fn(),
}));

// Mock retryWithBackoff to eliminate delays but preserve retry semantics
vi.mock("../utils/errors.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/errors.js")>("../utils/errors.js");
  return {
    ...actual,
    retryWithBackoff: async <T>(
      fn: () => Promise<T>,
      config?: { maxRetries?: number },
      onRetry?: (error: unknown, attempt: number) => void
    ): Promise<T> => {
      const maxRetries = config?.maxRetries ?? 3;
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error: unknown) {
          lastError = error;
          if (!actual.ErrorHandler.isRetryable(error)) throw error;
          if (attempt >= maxRetries) break;
          if (onRetry) onRetry(error, attempt);
        }
      }
      throw actual.ErrorHandler.wrapError(lastError, "Max retries exceeded");
    },
  };
});

import { CopyTrader } from "../copyTrader.js";
import { TradingError, ValidationError } from "../utils/errors.js";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function createMockClient() {
  return {
    getAddress: vi.fn().mockReturnValue("0xOUR_ADDRESS"),
    getAccountEquity: vi.fn().mockResolvedValue({ accountValue: "1000" }),
    getPositions: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue("order-123"),
    subscribeToUserFills: vi.fn().mockResolvedValue(() => {}),
    getUserFills: vi.fn().mockResolvedValue([]),
    isWsConnected: vi.fn().mockReturnValue(true),
  };
}

function makeFill(overrides: Partial<FillEvent> = {}): FillEvent {
  return {
    coin: "BTC",
    px: "67000",
    sz: "0.1",
    side: "B",
    time: Date.now(),
    startPosition: "0",
    dir: "Open Long",
    closedPnl: "0",
    hash: "0xhash123",
    oid: 1,
    crossed: false,
    fee: "0.01",
    ...overrides,
  };
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    coin: "BTC",
    szi: "0.1",
    entryPx: "67000",
    leverage: { value: "40" },
    liquidationPx: "60000",
    marginUsed: "167.5",
    returnOnEquity: "0",
    unrealizedPnl: "0",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let mockClient: ReturnType<typeof createMockClient>;
let copyTrader: CopyTrader;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset config to defaults
  Object.assign(mockConfig, {
    BLOCKED_ASSETS: [],
    MIN_NOTIONAL: 10,
    MAX_LEVERAGE: 40,
    MAX_POSITION_SIZE_PERCENT: 100,
    SIZE_MULTIPLIER: 1,
    MAX_CONCURRENT_TRADES: 10,
    DRY_RUN: false,
    ARENA_FEED_ENABLED: false,
  });

  mockClient = createMockClient();
  copyTrader = new CopyTrader(mockClient as any, "0xTARGET");
  // Prevent Node's EventEmitter from throwing on unhandled "error" events
  copyTrader.on("error", () => {});
});

// ---------------------------------------------------------------------------
// A. Basic trade flow
// ---------------------------------------------------------------------------
describe("Basic trade flow", () => {
  it("open long → placeOrder with side=B, reduceOnly=false", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" }) // our
      .mockResolvedValueOnce({ accountValue: "1000" }); // target
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    await (copyTrader as any).handleFill(makeFill({ dir: "Open Long" }));

    expect(mockClient.placeOrder).toHaveBeenCalledOnce();
    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.side).toBe("B");
    expect(call.reduceOnly).toBe(false);
    expect(call.leverage).toBe(40);
  });

  it("open short → placeOrder with side=A, reduceOnly=false", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "-0.1", leverage: { value: "40" } }),
    ]);

    await (copyTrader as any).handleFill(makeFill({ dir: "Open Short", side: "A" }));

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.side).toBe("A");
    expect(call.reduceOnly).toBe(false);
  });

  it("close long full → placeOrder with reduceOnly=true", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "0.1", leverage: { value: "40" } }),
    ]);

    const fill = makeFill({
      dir: "Close Long",
      startPosition: "0.1",
      sz: "0.1",
      side: "A",
    });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.reduceOnly).toBe(true);
  });

  it("close short full → placeOrder with reduceOnly=true", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "-0.1", leverage: { value: "40" } }),
    ]);

    const fill = makeFill({
      dir: "Close Short",
      startPosition: "-0.1",
      sz: "0.1",
      side: "B",
    });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.reduceOnly).toBe(true);
    expect(call.side).toBe("B"); // closing short → buy back
  });

  it("partial reduce → placeOrder with reduceOnly=true", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "1.0", leverage: { value: "40" } }),
    ]);

    const fill = makeFill({
      dir: "Close Long",
      startPosition: "1.0",
      sz: "0.3",
      side: "A",
    });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.reduceOnly).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B. Position sizing
// ---------------------------------------------------------------------------
describe("Position sizing", () => {
  it("proportional sizing: $500/$1000 → ratio 0.5", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "500" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    const fill = makeFill({ sz: "0.5", px: "80000" });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    // ratio=0.5, calc=0.25, maxCoinQty=20000/80000=0.25 → 0.25
    expect(call.sz).toBe("0.25");
  });

  it("cap triggers when ratio amplifies beyond budget", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "100" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "10" } }),
    ]);

    // ratio=10, calc=1.0, maxCoinQty=(1000*10)/50000=0.2 → capped
    const fill = makeFill({ sz: "0.1", px: "50000" });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.sz).toBe("0.2");
  });

  it("SIZE_MULTIPLIER scales output", async () => {
    mockConfig.SIZE_MULTIPLIER = 0.5;
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    const fill = makeFill({ sz: "0.1", px: "67000" });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    // ratio=1, mult=0.5, calc=0.05
    expect(parseFloat(call.sz)).toBeCloseTo(0.05, 6);
  });

  it("target equity=0 fallback → raw size * multiplier", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "0" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    const fill = makeFill({ sz: "0.1", px: "67000" });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    // targetEquity=0 → size=0.1*1=0.1
    expect(parseFloat(call.sz)).toBeCloseTo(0.1, 6);
  });
});

// ---------------------------------------------------------------------------
// C. Validation bypass for closes
// ---------------------------------------------------------------------------
describe("Validation bypass for closes", () => {
  it("close skips validation — tiny equity can close large position", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "10" }) // our tiny equity
      .mockResolvedValueOnce({ accountValue: "10" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "1.0", leverage: { value: "40" } }),
    ]);

    const fill = makeFill({
      dir: "Close Long",
      startPosition: "1.0",
      sz: "1.0",
      px: "16000",
    });
    await (copyTrader as any).handleFill(fill);

    // Close should still go through despite tiny equity
    expect(mockClient.placeOrder).toHaveBeenCalledOnce();
    expect(mockClient.placeOrder.mock.calls[0][0].reduceOnly).toBe(true);
  });

  it("reduce skips validation — tiny equity can reduce position", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "10" })
      .mockResolvedValueOnce({ accountValue: "10" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "1.0", leverage: { value: "40" } }),
    ]);

    const fill = makeFill({
      dir: "Close Long",
      startPosition: "1.0",
      sz: "0.3",
      px: "16000",
    });
    await (copyTrader as any).handleFill(fill);

    expect(mockClient.placeOrder).toHaveBeenCalledOnce();
    expect(mockClient.placeOrder.mock.calls[0][0].reduceOnly).toBe(true);
  });

  it("open respects validation — tiny equity blocks open (min notional)", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "0.1" }) // super tiny
      .mockResolvedValueOnce({ accountValue: "0.1" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    // ratio=1, calc=1.0, cap: maxNotional=0.1*40=4, maxCoinQty=4/67000≈0.00006
    // notional = 0.00006*67000 ≈ 4 < 10 MIN_NOTIONAL → blocked
    const fill = makeFill({ dir: "Open Long", sz: "1.0", px: "67000" });
    await (copyTrader as any).handleFill(fill);

    expect(mockClient.placeOrder).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// D. Edge cases
// ---------------------------------------------------------------------------
describe("Edge cases", () => {
  it("max concurrent trades: open blocked, close still works", async () => {
    mockConfig.MAX_CONCURRENT_TRADES = 0; // Already at max (0 allowed)

    mockClient.getAccountEquity
      .mockResolvedValue({ accountValue: "10000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    // Open should be blocked
    await (copyTrader as any).handleFill(makeFill({ dir: "Open Long" }));
    expect(mockClient.placeOrder).not.toHaveBeenCalled();

    // Close should still work
    const closeFill = makeFill({
      dir: "Close Long",
      startPosition: "0.1",
      sz: "0.1",
    });
    await (copyTrader as any).handleFill(closeFill);
    expect(mockClient.placeOrder).toHaveBeenCalledOnce();
  });

  it("blocked asset → no order placed", async () => {
    mockConfig.BLOCKED_ASSETS = ["DOGE"];
    mockClient.getAccountEquity
      .mockResolvedValue({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ coin: "DOGE", leverage: { value: "40" } }),
    ]);

    const fill = makeFill({ coin: "DOGE", dir: "Open Long" });
    await (copyTrader as any).handleFill(fill);

    expect(mockClient.placeOrder).not.toHaveBeenCalled();
  });

  it("below min notional → no order placed", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    // Very small size: 0.000001 * 10 = 0.00001 < 10 MIN_NOTIONAL
    const fill = makeFill({ sz: "0.000001", px: "10" });
    await (copyTrader as any).handleFill(fill);

    expect(mockClient.placeOrder).not.toHaveBeenCalled();
  });

  it("leverage capping: target at 100x → capped to 40x", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "100" } }),
    ]);

    await (copyTrader as any).handleFill(makeFill());

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.leverage).toBe(40);
  });

  it("invalid equity (NaN) → throws ValidationError, no trade", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "not-a-number" })
      .mockResolvedValueOnce({ accountValue: "1000" });

    const errors: any[] = [];
    copyTrader.on("error", (e) => errors.push(e));

    await (copyTrader as any).handleFill(makeFill());

    expect(mockClient.placeOrder).not.toHaveBeenCalled();
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("very small precision: 8 decimal places preserved, trailing zeros stripped", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "500" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ szi: "0.001", leverage: { value: "40" } }),
    ]);

    // Use a reduce order to bypass min-notional validation
    const fill = makeFill({
      sz: "0.00012345",
      px: "67000",
      dir: "Close Long",
      startPosition: "0.001",
    });
    await (copyTrader as any).handleFill(fill);

    const call = mockClient.placeOrder.mock.calls[0][0];
    expect(call.sz).not.toMatch(/0+$/);
    expect(call.reduceOnly).toBe(true);
    expect(parseFloat(call.sz)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// E. DRY_RUN
// ---------------------------------------------------------------------------
describe("DRY_RUN", () => {
  it("dry run mode returns dry-run-order-id, no real API call logic", async () => {
    mockConfig.DRY_RUN = true;
    mockClient.placeOrder.mockResolvedValue("dry-run-order-id");

    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    const events: any[] = [];
    copyTrader.on("trade", (e) => events.push(e));

    await (copyTrader as any).handleFill(makeFill());

    expect(mockClient.placeOrder).toHaveBeenCalledOnce();
    expect(events.length).toBe(1);
    expect(events[0].result.orderId).toBe("dry-run-order-id");
  });
});

// ---------------------------------------------------------------------------
// F. Error handling
// ---------------------------------------------------------------------------
describe("Error handling", () => {
  it("retryable error + success on 2nd attempt", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    // First call throws retryable, second succeeds
    mockClient.placeOrder
      .mockRejectedValueOnce(new TradingError("Temporary failure", true))
      .mockResolvedValueOnce("order-456");

    const events: any[] = [];
    copyTrader.on("trade", (e) => events.push(e));

    await (copyTrader as any).handleFill(makeFill());

    expect(mockClient.placeOrder).toHaveBeenCalledTimes(2);
    expect(events.length).toBe(1);
    expect(events[0].result.success).toBe(true);
    expect(events[0].result.orderId).toBe("order-456");
  });

  it("non-retryable error fails immediately", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    mockClient.placeOrder.mockRejectedValue(
      new ValidationError("Invalid params")
    );

    const errors: any[] = [];
    copyTrader.on("error", (e) => errors.push(e));

    await (copyTrader as any).handleFill(makeFill());

    // ValidationError is not retryable → placeOrder called only once
    expect(mockClient.placeOrder).toHaveBeenCalledOnce();
    expect(errors.length).toBe(1);
    expect(errors[0].error).toContain("Invalid params");
  });
});

// ---------------------------------------------------------------------------
// G. Event emissions
// ---------------------------------------------------------------------------
describe("Event emissions", () => {
  it("successful trade emits fill then trade events", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);

    const fills: any[] = [];
    const trades: any[] = [];
    copyTrader.on("fill", (e) => fills.push(e));
    copyTrader.on("trade", (e) => trades.push(e));

    await (copyTrader as any).handleFill(makeFill());

    expect(fills.length).toBe(1);
    expect(fills[0].action).toBe("open");
    expect(trades.length).toBe(1);
    expect(trades[0].result.orderId).toBe("order-123");
    expect(trades[0].params.coin).toBe("BTC");
  });

  it("failed trade emits fill then error events", async () => {
    mockClient.getAccountEquity
      .mockResolvedValueOnce({ accountValue: "1000" })
      .mockResolvedValueOnce({ accountValue: "1000" });
    mockClient.getPositions.mockResolvedValue([
      makePosition({ leverage: { value: "40" } }),
    ]);
    mockClient.placeOrder.mockRejectedValue(
      new ValidationError("Order rejected")
    );

    const fills: any[] = [];
    const errors: any[] = [];
    copyTrader.on("fill", (e) => fills.push(e));
    copyTrader.on("error", (e) => errors.push(e));

    await (copyTrader as any).handleFill(makeFill());

    expect(fills.length).toBe(1);
    expect(errors.length).toBe(1);
    expect(errors[0].error).toContain("Order rejected");
  });
});
