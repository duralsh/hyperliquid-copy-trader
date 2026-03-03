import { Router } from "express";
import { botManager } from "../services/botManager.js";
import type { BotConfig } from "../../../shared/types.js";

const router = Router();

router.post("/start", async (req, res) => {
  try {
    const body = req.body as Partial<BotConfig>;
    if (!body.targetWallet) {
      res.status(400).json({ error: "targetWallet is required" });
      return;
    }
    const config: BotConfig = {
      targetWallet: body.targetWallet,
      sizeMultiplier: body.sizeMultiplier ?? 1.0,
      maxLeverage: body.maxLeverage ?? 20,
      maxPositionSizePercent: body.maxPositionSizePercent ?? 50,
      blockedAssets: body.blockedAssets ?? [],
      dryRun: body.dryRun ?? false,
    };
    const status = await botManager.start(config);
    res.json(status);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to start bot";
    console.error("Bot start error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/stop", async (_req, res) => {
  try {
    const status = await botManager.stop();
    res.json(status);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to stop bot";
    console.error("Bot stop error:", error);
    res.status(500).json({ error: msg });
  }
});

router.get("/status", (_req, res) => {
  res.json(botManager.getStatus());
});

router.get("/trades", (_req, res) => {
  res.json(botManager.getTradeHistory());
});

export default router;
