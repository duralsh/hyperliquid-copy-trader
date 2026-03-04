import { Router } from "express";
import { fetchWalletBalances, deposit, withdraw } from "../services/walletService.js";

const router = Router();

router.get("/balances", async (req, res) => {
  try {
    const balances = await fetchWalletBalances(req.userContext?.walletAddress);
    res.json(balances);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch balances";
    console.error("Wallet balances error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/deposit", async (req, res) => {
  try {
    const { amount } = req.body as { amount?: number };
    if (!amount || typeof amount !== "number" || amount < 5) {
      res.status(400).json({ error: "Amount must be a number >= 5 USDC" });
      return;
    }
    const txHash = await deposit(amount, req.userContext?.privateKey);
    res.json({ txHash });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Deposit failed";
    console.error("Deposit error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/withdraw", async (req, res) => {
  try {
    const { amount } = req.body as { amount?: number };
    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }
    const result = await withdraw(amount, req.userContext?.walletAddress, req.userContext?.privateKey);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Withdraw failed";
    console.error("Withdraw error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
