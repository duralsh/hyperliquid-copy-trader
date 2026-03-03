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
import { botManager } from "./services/botManager.js";
const PORT = parseInt(process.env.DASHBOARD_PORT ?? "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/trader", traderRouter);
app.use("/api/bot", botRouter);
app.use("/api/account", accountRouter);
app.use("/api/arena", arenaRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/smart-filter", smartFilterRouter);

// Serve static client build in production
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Forward bot events to WebSocket clients
botManager.on("bot:status", (data) => broadcast("bot:status", data));
botManager.on("bot:trade", (data) => broadcast("bot:trade", data));
botManager.on("bot:error", (data) => broadcast("bot:error", data));

wss.on("connection", (ws) => {
  console.log("[ws] client connected");
  // Send current status on connect
  ws.send(JSON.stringify({ event: "bot:status", data: botManager.getStatus() }));
  ws.on("close", () => console.log("[ws] client disconnected"));
});

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
