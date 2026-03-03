import { Router } from "express";
import { fetchMyAccount } from "../services/accountService.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const data = await fetchMyAccount();
    res.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch account data";
    console.error("Account error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
