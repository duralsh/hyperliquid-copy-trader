import { Router } from "express";
import { fetchTraderDetail, fetchTraderFills } from "../services/traderService.js";

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

router.get("/:address/fills", async (req, res) => {
  try {
    const { address } = req.params;
    if (!address || !address.startsWith("0x")) {
      res.status(400).json({ error: "Invalid address" });
      return;
    }
    const fills = await fetchTraderFills(address);
    res.json(fills);
  } catch (error) {
    console.error("Trader fills error:", error);
    res.status(500).json({ error: "Failed to fetch trader fills" });
  }
});

export default router;
