import { Router } from "express";
import { fetchTraderDetail } from "../services/traderService.js";

const router = Router();

router.get("/:address/positions", async (req, res) => {
  try {
    const { address } = req.params;
    if (!address || !address.startsWith("0x")) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    const detail = await fetchTraderDetail(address);
    res.json(detail);
  } catch (error) {
    console.error("Trader detail error:", error);
    res.status(500).json({ error: "Failed to fetch trader positions" });
  }
});

export default router;
