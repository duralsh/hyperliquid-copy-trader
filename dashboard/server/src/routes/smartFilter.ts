import { Router } from "express";
import { runSmartFilter } from "../services/smartFilterService.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const refresh = req.query.refresh === "true";
    const data = await runSmartFilter(refresh);
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to run smart filter";
    console.error("Smart filter error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
