import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config.js", () => ({
  copyTradingConfig: {
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

vi.mock("../../logger.js", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { copyTradingConfig } from "../../config.js";
import {
  removeTrailingZeros,
  isAssetBlocked,
  meetsMinimumNotional,
  capLeverage,
  capPositionSize,
  calculatePositionSize,
  getTradeAction,
  validateTradeParams,
} from "../risk.js";
import type { FillEvent, CopyTradeParams } from "../../types.js";

const cfg = copyTradingConfig as Record<string, unknown>;

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
    hash: "0xabc",
    oid: 1,
    crossed: false,
    fee: "0.01",
    ...overrides,
  };
}

beforeEach(() => {
  cfg.BLOCKED_ASSETS = [];
  cfg.MIN_NOTIONAL = 10;
  cfg.MAX_LEVERAGE = 40;
  cfg.MAX_POSITION_SIZE_PERCENT = 100;
  cfg.SIZE_MULTIPLIER = 1;
});

// ---------------------------------------------------------------------------
// removeTrailingZeros
// ---------------------------------------------------------------------------
describe("removeTrailingZeros", () => {
  it("strips trailing zeros after decimal", () => {
    expect(removeTrailingZeros("1.50000")).toBe("1.5");
  });

  it("removes .00 from integer-like value", () => {
    expect(removeTrailingZeros("100.00")).toBe("100");
  });

  it("strips single trailing zero", () => {
    expect(removeTrailingZeros("0.10")).toBe("0.1");
  });

  it("no-op when no decimal point", () => {
    expect(removeTrailingZeros("42")).toBe("42");
  });

  it("preserves inner zeros", () => {
    expect(removeTrailingZeros("0.00100")).toBe("0.001");
  });
});

// ---------------------------------------------------------------------------
// isAssetBlocked
// ---------------------------------------------------------------------------
describe("isAssetBlocked", () => {
  it("returns false when BLOCKED_ASSETS is empty", () => {
    cfg.BLOCKED_ASSETS = [];
    expect(isAssetBlocked("BTC")).toBe(false);
  });

  it("returns true for blocked asset", () => {
    cfg.BLOCKED_ASSETS = ["DOGE"];
    expect(isAssetBlocked("DOGE")).toBe(true);
  });

  it("is case-insensitive (input is uppercased)", () => {
    cfg.BLOCKED_ASSETS = ["DOGE"];
    expect(isAssetBlocked("doge")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// meetsMinimumNotional
// ---------------------------------------------------------------------------
describe("meetsMinimumNotional", () => {
  it("passes at exact boundary (size*price == MIN_NOTIONAL)", () => {
    expect(meetsMinimumNotional("1", "10")).toBe(true);
  });

  it("fails below minimum", () => {
    expect(meetsMinimumNotional("0.5", "10")).toBe(false);
  });

  it("passes well above minimum", () => {
    expect(meetsMinimumNotional("100", "100")).toBe(true);
  });

  it("fails when size is zero", () => {
    expect(meetsMinimumNotional("0", "67000")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// capLeverage
// ---------------------------------------------------------------------------
describe("capLeverage", () => {
  it("passes through leverage under max", () => {
    expect(capLeverage(20)).toBe(20);
  });

  it("returns max at exact boundary", () => {
    expect(capLeverage(40)).toBe(40);
  });

  it("caps leverage above max", () => {
    expect(capLeverage(100)).toBe(40);
  });

  it("allows leverage of 1", () => {
    expect(capLeverage(1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// capPositionSize
// ---------------------------------------------------------------------------
describe("capPositionSize", () => {
  // MAX_POSITION_SIZE_PERCENT=100 → maxMargin = ourEquity

  it("no cap needed — size well below max", () => {
    // maxMargin=1000, maxNotional=40000, maxCoinQty=40000/67000≈0.597
    const result = capPositionSize(0.01, 1000, 67000, 40);
    expect(result).toBe(0.01);
  });

  it("caps when size exceeds max coin qty", () => {
    // maxMargin=300, maxNotional=12000, maxCoinQty=12000/67000≈0.1791
    const result = capPositionSize(0.5, 300, 67000, 40);
    expect(result).toBeCloseTo(12000 / 67000, 8);
  });

  it("exact boundary — size equals max coin qty", () => {
    // maxMargin=500, maxNotional=20000, maxCoinQty=20000/80000=0.25
    const result = capPositionSize(0.25, 500, 80000, 40);
    expect(result).toBe(0.25);
  });

  it("zero leverage treated as 1x", () => {
    // safeLev=1, maxMargin=500, maxNotional=500, maxCoinQty=500/80000=0.00625
    const result = capPositionSize(0.1, 500, 80000, 0);
    expect(result).toBe(0.00625);
  });

  it("zero price returns calculatedSize unchanged", () => {
    // price <= 0 → maxCoinQty = calculatedSize
    const result = capPositionSize(0.1, 500, 0, 40);
    expect(result).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// calculatePositionSize
// ---------------------------------------------------------------------------
describe("calculatePositionSize", () => {
  it("equal equities — ratio 1, size unchanged", () => {
    // ratio=1, calc=0.1, cap: maxNotional=40000, maxCoinQty≈0.597 → 0.1
    const result = calculatePositionSize(0.1, 1000, 1000, 67000, 40);
    expect(result).toBeCloseTo(0.1, 8);
  });

  it("half equity — $500 margin budget", () => {
    // ratio=0.5, calc=0.25, cap: maxNotional=20000, maxCoinQty=0.25 → 0.25
    const result = calculatePositionSize(0.5, 500, 1000, 80000, 40);
    expect(result).toBe(0.25);
  });

  it("double equity — ratio 2", () => {
    // ratio=2, calc=1.0, cap: maxNotional=80000, maxCoinQty=1.0 → 1.0
    const result = calculatePositionSize(0.5, 2000, 1000, 80000, 40);
    expect(result).toBe(1.0);
  });

  it("target equity 0 — uses raw size * multiplier, no ratio", () => {
    const result = calculatePositionSize(0.5, 1000, 0, 80000, 40);
    expect(result).toBe(0.5); // 0.5 * 1 (SIZE_MULTIPLIER)
  });

  it("cap triggers when ratio amplifies size beyond budget", () => {
    // ratio=3, calc=0.3, cap: maxNotional=3000, maxCoinQty=3000/67000≈0.04478
    const result = calculatePositionSize(0.1, 300, 100, 67000, 10);
    expect(result).toBeCloseTo(3000 / 67000, 6);
  });

  it("SIZE_MULTIPLIER scales output", () => {
    cfg.SIZE_MULTIPLIER = 0.5;
    // ratio=1, calc=0.05, cap: maxNotional=40000, maxCoinQty≈0.597 → 0.05
    const result = calculatePositionSize(0.1, 1000, 1000, 67000, 40);
    expect(result).toBeCloseTo(0.05, 8);
  });
});

// ---------------------------------------------------------------------------
// getTradeAction
// ---------------------------------------------------------------------------
describe("getTradeAction", () => {
  it("Open Long → open", () => {
    expect(getTradeAction(makeFill({ dir: "Open Long" }))).toBe("open");
  });

  it("Open Short → open", () => {
    expect(getTradeAction(makeFill({ dir: "Open Short" }))).toBe("open");
  });

  it("Close Long full close — |startPos| == fillSize", () => {
    expect(
      getTradeAction(makeFill({ dir: "Close Long", startPosition: "1.0", sz: "1.0" }))
    ).toBe("close");
  });

  it("Close Short full close", () => {
    expect(
      getTradeAction(makeFill({ dir: "Close Short", startPosition: "-0.5", sz: "0.5" }))
    ).toBe("close");
  });

  it("Close Long partial → reduce", () => {
    expect(
      getTradeAction(makeFill({ dir: "Close Long", startPosition: "1.0", sz: "0.3" }))
    ).toBe("reduce");
  });

  it("Close Short partial → reduce", () => {
    expect(
      getTradeAction(makeFill({ dir: "Close Short", startPosition: "-1.0", sz: "0.1" }))
    ).toBe("reduce");
  });

  it("boundary: |startPos| just under fillSize → close", () => {
    expect(
      getTradeAction(makeFill({ dir: "Close Long", startPosition: "0.99999", sz: "1.0" }))
    ).toBe("close");
  });
});

// ---------------------------------------------------------------------------
// validateTradeParams
// ---------------------------------------------------------------------------
describe("validateTradeParams", () => {
  function makeParams(overrides: Partial<CopyTradeParams> = {}): CopyTradeParams {
    return {
      coin: "BTC",
      side: "B",
      size: "0.1",
      orderType: "Market",
      reduceOnly: false,
      leverage: 40,
      ...overrides,
    };
  }

  it("valid trade passes all checks", () => {
    // notional=0.1*67000=6700, margin=6700/40=167.5, maxAllowed=1000 → valid
    const result = validateTradeParams(makeParams(), "67000", 1000);
    expect(result).toEqual({ valid: true });
  });

  it("blocked asset → invalid", () => {
    cfg.BLOCKED_ASSETS = ["BTC"];
    const result = validateTradeParams(makeParams(), "67000", 1000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("blocked");
  });

  it("below min notional → invalid", () => {
    const result = validateTradeParams(makeParams({ size: "0.0001" }), "10", 1000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("minimum");
  });

  it("leverage exceeds max → invalid", () => {
    const result = validateTradeParams(makeParams({ leverage: 50 }), "67000", 1000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Leverage");
  });

  it("margin OK at max: $40k notional at 40x, equity=$1000", () => {
    // margin=40000/40=1000, maxAllowed=1000 → exactly at boundary
    const params = makeParams({ size: "1", leverage: 40 });
    const result = validateTradeParams(params, "40000", 1000);
    expect(result).toEqual({ valid: true });
  });

  it("margin exceeds: $40k at 1x, equity=$300 → invalid", () => {
    // margin=40000/1=40000, maxAllowed=300
    const params = makeParams({ size: "1", leverage: 1 });
    const result = validateTradeParams(params, "40000", 300);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Margin required");
  });

  it("leverage 0 treated as 1x", () => {
    // margin=6700/1=6700, maxAllowed=1000 → invalid (6700 > 1000)
    const params = makeParams({ leverage: 0 });
    const result = validateTradeParams(params, "67000", 1000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Margin required");
  });
});
