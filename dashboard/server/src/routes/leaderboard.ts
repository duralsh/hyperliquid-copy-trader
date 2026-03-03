import { Router } from "express";
import { queryLeaderboard } from "../services/leaderboardService.js";
import type { LeaderboardQuery } from "../../../shared/types.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query: LeaderboardQuery = {
      sort: (req.query.sort as LeaderboardQuery["sort"]) ?? "pnl",
      window: (req.query.window as LeaderboardQuery["window"]) ?? "month",
      order: (req.query.order as LeaderboardQuery["order"]) ?? "desc",
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      minAccountValue: req.query.minAccountValue ? parseFloat(req.query.minAccountValue as string) : undefined,
      maxAccountValue: req.query.maxAccountValue ? parseFloat(req.query.maxAccountValue as string) : undefined,
    };
    const data = await queryLeaderboard(query);
    res.json(data);
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

export default router;
