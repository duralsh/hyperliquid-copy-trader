import { Router } from "express";
import { botManager } from "../services/botManager.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { BotConfig } from "../../../shared/types.js";

const router = Router();

router.post("/start", asyncHandler("Bot start", async (req, res) => {
  const body = req.body as Partial<BotConfig>;
  if (!body.targetWallet) {
    res.status(400).json({ error: "targetWallet is required" });
    return;
  }
  const config: BotConfig = {
    targetWallet: body.targetWallet,
    sizeMultiplier: body.sizeMultiplier ?? 1.0,
    maxLeverage: body.maxLeverage ?? 40,
    maxPositionSizePercent: body.maxPositionSizePercent ?? 100,
    blockedAssets: body.blockedAssets ?? [],
    dryRun: body.dryRun ?? false,
  };
  const status = await botManager.start(config, req.user?.userId, req.userContext);
  res.json(status);
}));

router.post("/stop", asyncHandler("Bot stop", async (req, res) => {
  const status = await botManager.stop(req.user?.userId);
  res.json(status);
}));

router.get("/status", (req, res) => {
  res.json(botManager.getStatus(req.user?.userId));
});

router.get("/trades", (req, res) => {
  res.json(botManager.getTradeHistory(req.user?.userId));
});

export default router;
