import { Router } from "express";
import { fetchWalletBalances, deposit, withdraw } from "../services/walletService.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/balances", asyncHandler("Wallet balances", async (req, res) => {
  const balances = await fetchWalletBalances(req.userContext?.walletAddress);
  res.json(balances);
}));

router.post("/deposit", asyncHandler("Deposit", async (req, res) => {
  const { amount } = req.body as { amount?: number };
  if (!amount || typeof amount !== "number" || amount < 5) {
    res.status(400).json({ error: "Amount must be a number >= 5 USDC" });
    return;
  }
  const txHash = await deposit(amount, req.userContext?.privateKey);
  res.json({ txHash });
}));

router.post("/withdraw", asyncHandler("Withdraw", async (req, res) => {
  const { amount } = req.body as { amount?: number };
  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" });
    return;
  }
  const result = await withdraw(amount, req.userContext?.walletAddress, req.userContext?.privateKey);
  res.json(result);
}));

export default router;
