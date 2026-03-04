import { Router } from "express";
import { getTokenPrices } from "../services/priceService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler("Price fetch", async (_req, res) => {
  const prices = await getTokenPrices();
  res.json(prices);
}));

export default router;
