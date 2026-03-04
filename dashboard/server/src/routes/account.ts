import { Router } from "express";
import { fetchMyAccount, closeAllPositions, closePosition } from "../services/accountService.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const data = await fetchMyAccount(req.userContext?.walletAddress);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch account data";
    console.error("Account error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/close-position", async (req, res) => {
  try {
    const { coin } = req.body as { coin?: string };
    if (!coin || typeof coin !== "string") {
      res.status(400).json({ error: "Missing or invalid 'coin' in request body" });
      return;
    }
    const result = await closePosition(coin, req.userContext?.walletAddress, req.userContext?.arenaApiKey);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to close position";
    console.error("Close position error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/close-all", async (req, res) => {
  try {
    const result = await closeAllPositions(req.userContext?.walletAddress, req.userContext?.arenaApiKey);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to close positions";
    console.error("Close all error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
