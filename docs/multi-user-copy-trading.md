# Multi-User Copy Trading Architecture

## Current Limitation

The copy trading engine (`src/copytrading/`) reads wallet credentials from `process.env` via a shared `config` object (`src/config.ts`). The `config` uses lazy getters that read `process.env` on **every access**, not just at init time:

```typescript
export const config = {
  get apiKey(): string { return optionalEnv("ARENA_API_KEY"); },
  mainWalletPrivateKey: optionalEnv("MAIN_WALLET_PRIVATE_KEY"),
  mainWalletAddress: optionalEnv("MAIN_WALLET_ADDRESS"),
  // ...
};
```

The `HyperliquidClientWrapper` reads `config.mainWalletAddress` in its constructor. The order execution (`src/trading/orders.ts`) and signing modules use `config.apiKey` and `config.mainWalletPrivateKey` at call time via `ArenaClient`.

**Problem**: `process.env` is global. If user A starts a bot (sets env vars to their credentials) and user B starts a bot (overwrites env vars), user A's bot is now trading with user B's wallet. This is catastrophic.

**Current workaround**: Only one user (the admin) can run a bot at a time.

---

## Solution: Per-User Credential Injection

### Option A: Refactor CopyTrader to Accept Credentials (Recommended)

Thread a `UserContext` (or similar credentials object) through the trading stack instead of reading `process.env`:

#### 1. Make `config` injectable

```typescript
// src/copytrading/config.ts — new
export interface CopyTradingCredentials {
  privateKey: string;
  walletAddress: string;
  arenaApiKey: string;
  arenaBaseUrl: string;
  arbitrumRpcUrl: string;
}
```

#### 2. Refactor `HyperliquidClientWrapper`

```typescript
class HyperliquidClientWrapper {
  constructor(private creds: CopyTradingCredentials) {
    this.ourAddress = creds.walletAddress;
  }
}
```

#### 3. Refactor `ArenaClient` to be instantiable

Currently `arenaClient()` returns a singleton. Change to:

```typescript
class ArenaClient {
  constructor(private apiKey: string, private baseUrl: string) {}
  // ... methods use this.apiKey instead of config.apiKey
}
```

#### 4. Thread credentials through orders/leverage/signing

`placeOrder()`, `closePosition()`, `setLeverage()` all need the private key for EIP-712 signing and the API key for Arena API calls. Pass them explicitly:

```typescript
async function placeOrder(params: OrderParams, creds: CopyTradingCredentials): Promise<OrderResult>
```

#### 5. Update `BotManager`

Each `BotInstance` creates its own `HyperliquidClientWrapper` and `CopyTrader` with the user's decrypted credentials. No `process.env` mutation.

#### Files to modify:
- `src/config.ts` — add `CopyTradingCredentials` type
- `src/client/arenaClient.ts` — make instantiable (not singleton)
- `src/copytrading/hyperliquidClient.ts` — accept creds in constructor
- `src/copytrading/copyTrader.ts` — accept and forward creds
- `src/trading/orders.ts` — accept creds param
- `src/trading/leverage.ts` — accept creds param
- `src/trading/marketData.ts` — accept creds param
- `src/onboarding/eip712.ts` — already accepts privateKey (good)
- `dashboard/server/src/services/botManager.ts` — pass creds, no env mutation

---

## Multi-User Fill Polling Architecture

Each copy trading bot needs to detect when the target trader opens/closes positions. Currently this is done via a **WebSocket subscription** to Hyperliquid's fill feed for the target wallet.

### Current Architecture (Single User)

```
                    ┌──────────────────┐
                    │  Hyperliquid WS  │
                    │  (target fills)  │
                    └───────┬──────────┘
                            │ fill events
                            ▼
                    ┌──────────────────┐
                    │   CopyTrader     │
                    │ (single process) │
                    └───────┬──────────┘
                            │ execute trades
                            ▼
                    ┌──────────────────┐
                    │   Arena API      │
                    │ (place orders)   │
                    └──────────────────┘
```

### Multi-User Options

#### Option 1: Shared WebSocket, Per-User Execution (Recommended)

Multiple users can copy the **same** target trader. Instead of opening N WebSocket connections for N users all watching the same wallet, share a single connection:

```
                    ┌──────────────────┐
                    │  Hyperliquid WS  │
                    │  (target fills)  │
                    └───────┬──────────┘
                            │ fill events
                            ▼
                    ┌──────────────────────────┐
                    │   FillRouter (singleton)  │
                    │   targetWallet → Set<Bot> │
                    └───┬──────────┬────────────┘
                        │          │
                        ▼          ▼
                  ┌──────────┐ ┌──────────┐
                  │ Bot (A)  │ │ Bot (B)  │
                  │ credsA   │ │ credsB   │
                  └────┬─────┘ └────┬─────┘
                       │            │
                       ▼            ▼
                  ┌──────────┐ ┌──────────┐
                  │ Arena(A) │ │ Arena(B) │
                  └──────────┘ └──────────┘
```

**Implementation:**

```typescript
class FillRouter {
  // One WS per target wallet, shared across users
  private connections = new Map<string, {
    ws: WebSocket;
    subscribers: Map<number, CopyTrader>; // userId → bot
  }>();

  subscribe(targetWallet: string, userId: number, bot: CopyTrader) {
    let conn = this.connections.get(targetWallet);
    if (!conn) {
      // Open new WS for this target
      const ws = this.openTargetWS(targetWallet);
      conn = { ws, subscribers: new Map() };
      this.connections.set(targetWallet, conn);
    }
    conn.subscribers.set(userId, bot);
  }

  unsubscribe(targetWallet: string, userId: number) {
    const conn = this.connections.get(targetWallet);
    if (!conn) return;
    conn.subscribers.delete(userId);
    // Close WS if no more subscribers
    if (conn.subscribers.size === 0) {
      conn.ws.close();
      this.connections.delete(targetWallet);
    }
  }

  // Called when a fill arrives from the WS
  private onFill(targetWallet: string, fill: FillEvent) {
    const conn = this.connections.get(targetWallet);
    if (!conn) return;
    // Fan out to all subscribers — each executes with own credentials
    for (const [userId, bot] of conn.subscribers) {
      bot.handleFill(fill).catch(err => {
        logger.error(`Fill handling failed for user ${userId}`, err);
      });
    }
  }
}
```

**Pros:**
- Efficient — one WS connection per target wallet regardless of user count
- Simple — all in one process, shared memory
- No IPC overhead

**Cons:**
- Single process bottleneck for trade execution
- If the process crashes, all users lose their bots

#### Option 2: Worker Threads (Per-User Isolation)

Spawn a Node.js worker thread per user. Each worker runs its own CopyTrader with its own credentials and WebSocket connection.

```
Main Thread (Express server)
    │
    ├── Worker Thread (User A)
    │   └── CopyTrader(credsA) → WS → Arena API
    │
    ├── Worker Thread (User B)
    │   └── CopyTrader(credsB) → WS → Arena API
    │
    └── Worker Thread (User C)
        └── CopyTrader(credsC) → WS → Arena API
```

**Implementation:**

```typescript
// worker.ts — runs in a worker thread
import { parentPort, workerData } from 'worker_threads';

const { creds, targetWallet, config } = workerData;
const client = new HyperliquidClientWrapper(creds);
const trader = new CopyTrader(client, targetWallet, creds);

trader.on('trade', (data) => parentPort?.postMessage({ event: 'trade', data }));
trader.on('error', (data) => parentPort?.postMessage({ event: 'error', data }));

await trader.start();
```

```typescript
// botManager.ts — main thread
import { Worker } from 'worker_threads';

class BotManager {
  private workers = new Map<number, Worker>();

  start(userId: number, config: BotConfig, creds: CopyTradingCredentials) {
    const worker = new Worker('./worker.js', {
      workerData: { creds, targetWallet: config.targetWallet, config }
    });
    worker.on('message', (msg) => {
      this.emit(msg.event, { userId, ...msg.data });
    });
    this.workers.set(userId, worker);
  }

  stop(userId: number) {
    this.workers.get(userId)?.terminate();
    this.workers.delete(userId);
  }
}
```

**Pros:**
- Full isolation — one user's crash doesn't affect others
- No credential leakage between users
- Can scale to many users

**Cons:**
- Higher memory usage (each worker loads full Node.js context)
- More complex IPC for status updates
- Duplicate WS connections if multiple users copy the same trader

#### Option 3: Separate Processes (Maximum Isolation)

Spawn separate OS processes per user via `child_process.fork()`. Similar to workers but stronger isolation.

**Pros:** Full process isolation, can distribute across machines later
**Cons:** Highest resource usage, most complex orchestration

---

## Recommended Path

1. **Short term**: Option 1 (shared process, credential injection). Refactor `CopyTrader` stack to accept credentials. Use `FillRouter` to share WS connections. This is the least disruptive change.

2. **Medium term**: If user count grows beyond ~10 concurrent bots, move to Option 2 (worker threads) for isolation.

3. **Long term**: Option 3 with a job queue (Redis/BullMQ) for horizontal scaling across multiple servers.

---

## Implementation Priority

1. Refactor `config.ts` → injectable credentials type
2. Refactor `ArenaClient` → instantiable (not singleton)
3. Refactor `HyperliquidClientWrapper` → accept credentials
4. Refactor `CopyTrader` → accept and forward credentials
5. Thread credentials through `orders.ts`, `leverage.ts`
6. Implement `FillRouter` for shared WS connections
7. Update `BotManager` to use credential injection (no env mutation)
8. Re-enable multi-user registration
