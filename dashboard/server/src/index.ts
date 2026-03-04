import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

import leaderboardRouter from "./routes/leaderboard.js";
import traderRouter from "./routes/trader.js";
import botRouter from "./routes/bot.js";
import accountRouter from "./routes/account.js";
import arenaRouter from "./routes/arena.js";
import pricesRouter from "./routes/prices.js";
import smartFilterRouter from "./routes/smartFilter.js";
import dockerRouter from "./routes/docker.js";
import walletRouter from "./routes/wallet.js";
import authRouter from "./routes/auth.js";
import favoritesRouter from "./routes/favorites.js";
import { requireAuth, verifyToken } from "./middleware/auth.js";
import { resolveCredentials } from "./middleware/resolveCredentials.js";
import { bootstrapAdmin } from "./services/db.js";
import { botManager } from "./services/botManager.js";
import { startLogStream, onLine, getLogBuffer } from "./services/dockerLogService.js";
const PORT = parseInt(process.env.DASHBOARD_PORT ?? "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

// Public routes (no auth)
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/trader", traderRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/auth", authRouter);

// Protected routes (auth + credentials)
app.use("/api/account", requireAuth, resolveCredentials, accountRouter);
app.use("/api/bot", requireAuth, resolveCredentials, botRouter);
app.use("/api/arena", requireAuth, resolveCredentials, arenaRouter);
app.use("/api/smart-filter", requireAuth, resolveCredentials, smartFilterRouter);
app.use("/api/wallet", requireAuth, resolveCredentials, walletRouter);
app.use("/api/docker", requireAuth, dockerRouter);

// Protected routes (auth only, no credentials needed)
app.use("/api/favorites", favoritesRouter);

// Serve static client build in production
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });

// Tag WS connections with userId
interface TaggedWebSocket extends WebSocket {
  userId?: number;
}

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastToUser(userId: number, event: string, data: unknown) {
  const message = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    const tagged = client as TaggedWebSocket;
    if (tagged.readyState === WebSocket.OPEN && tagged.userId === userId) {
      tagged.send(message);
    }
  });
}

// Forward bot events to WebSocket clients (per-user)
botManager.on("bot:status", (data: { userId: number } & Record<string, unknown>) => {
  const { userId, ...rest } = data;
  broadcastToUser(userId, "bot:status", rest);
});
botManager.on("bot:trade", (data: { userId: number } & Record<string, unknown>) => {
  const { userId, ...rest } = data;
  broadcastToUser(userId, "bot:trade", rest);
});
botManager.on("bot:error", (data: { userId: number } & Record<string, unknown>) => {
  const { userId, ...rest } = data;
  broadcastToUser(userId, "bot:error", rest);
});
botManager.on("bot:switching", (data: { userId: number } & Record<string, unknown>) => {
  const { userId, ...rest } = data;
  broadcastToUser(userId, "bot:switching", rest);
});

// Forward docker log lines to WebSocket clients (broadcast to all)
onLine((entry) => broadcast("docker:log", entry));

wss.on("connection", (ws: TaggedWebSocket, req) => {
  // Parse token from query string
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  if (token) {
    try {
      const user = verifyToken(token);
      ws.userId = user.userId;
    } catch {
      // Invalid token — still allow connection for public data
    }
  }

  console.log("[ws] client connected", ws.userId ? `(user=${ws.userId})` : "(anonymous)");

  // Send current status on connect
  const status = ws.userId ? botManager.getStatus(ws.userId) : botManager.getStatus();
  ws.send(JSON.stringify({ event: "bot:status", data: status }));

  // Send buffered docker logs on connect
  for (const entry of getLogBuffer()) {
    ws.send(JSON.stringify({ event: "docker:log", data: entry }));
  }

  ws.on("close", () => console.log("[ws] client disconnected"));
});

// Start streaming docker logs from copy trader container
startLogStream();

// Bootstrap admin user from env vars
bootstrapAdmin();

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   HYPERLIQUID TRADER DASHBOARD           ║
║   http://localhost:${PORT}                  ║
║   API: http://localhost:${PORT}/api          ║
║   WS:  ws://localhost:${PORT}/ws             ║
╚══════════════════════════════════════════╝
  `);
});
