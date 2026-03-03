/**
 * Simple logger compatible with gamma-trade-lab CopyTrader expectations.
 * Uses console, no winston dependency.
 */

const LEVEL = (process.env.LOG_LEVEL ?? "info").toLowerCase();
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const levelNum = LEVELS[LEVEL as keyof typeof LEVELS] ?? 1;

function shouldLog(level: keyof typeof LEVELS): boolean {
  return (LEVELS[level] ?? 0) <= levelNum;
}

export const logger = {
  error: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("error")) console.error(`[ERROR] ${msg}`, meta ?? "");
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("warn")) console.warn(`[WARN] ${msg}`, meta ?? "");
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("info")) console.log(`[INFO] ${msg}`, meta ?? "");
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("debug")) console.log(`[DEBUG] ${msg}`, meta ?? "");
  },
};

export const loggerUtils = {
  logTrade: (
    level: "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>
  ) => logger[level](message, { ...meta, context: "trading", type: "trade" }),
  logPerformance: (operation: string, duration: number, meta?: Record<string, unknown>) =>
    logger.debug(`Perf: ${operation}`, { ...meta, duration: `${duration}ms`, operation }),
  logWebSocket: (event: string, message: string, meta?: Record<string, unknown>) =>
    logger.info(`WS [${event}] ${message}`, { ...meta, context: "websocket", event }),
};
