import { Router } from "express";
import { getTokenPrices } from "../services/priceService.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const prices = await getTokenPrices();
    res.json(prices);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch prices";
    console.error("Price fetch error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
