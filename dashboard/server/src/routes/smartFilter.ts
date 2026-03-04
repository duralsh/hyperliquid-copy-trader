import { Router } from "express";
import { runSmartFilter } from "../services/smartFilterService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler("Smart filter", async (req, res) => {
  const refresh = req.query.refresh === "true";
  const data = await runSmartFilter(refresh, req.userContext?.walletAddress);
  res.json(data);
}));

export default router;
