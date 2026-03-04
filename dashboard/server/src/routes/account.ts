import { Router } from "express";
import { fetchMyAccount, closeAllPositions, closePosition } from "../services/accountService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler("Account", async (req, res) => {
  const data = await fetchMyAccount(req.userContext?.walletAddress);
  res.json(data);
}));

router.post("/close-position", asyncHandler("Close position", async (req, res) => {
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
}));

router.post("/close-all", asyncHandler("Close all", async (req, res) => {
  const result = await closeAllPositions(req.userContext?.walletAddress, req.userContext?.arenaApiKey);
  res.json(result);
}));

export default router;
