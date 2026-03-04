import { Router } from "express";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { signTypedData } from "viem/actions";
import { arbitrum } from "viem/chains";
import { requireAuth, signToken } from "../middleware/auth.js";
import {
  findByUsername,
  verifyPassword,
  getPublicUser,
  saveCredentials,
} from "../services/userRepository.js";

const router = Router();

const ARENA_BASE_URL = () =>
  (process.env.ARENA_BASE_URL ?? "https://api.starsarena.com").replace(/\/$/, "");

router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const row = findByUsername(username);
    if (!row || !verifyPassword(row, password)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = signToken(row);
    const user = getPublicUser(row.id)!;
    res.json({ token, user });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Login failed";
    console.error("Login error:", error);
    res.status(500).json({ error: msg });
  }
});

router.post("/register", (_req, res) => {
  res.status(503).json({ error: "Registration is coming soon. Stay tuned." });
});

router.get("/me", requireAuth, (req, res) => {
  const user = getPublicUser(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});

/**
 * Step 1: Register agent with Arena.
 * Derives wallet from privateKey, calls Arena /agents/register.
 * Returns agentId, apiKey, verificationCode, walletAddress.
 * Does NOT store credentials yet.
 */
router.post("/onboard/register-agent", requireAuth, async (req, res) => {
  try {
    const { privateKey, agentName, agentHandle } = req.body as {
      privateKey?: string;
      agentName?: string;
      agentHandle?: string;
    };
    if (!privateKey) {
      res.status(400).json({ error: "Private key is required" });
      return;
    }
    if (!agentName || !agentHandle) {
      res.status(400).json({ error: "Agent name and handle are required" });
      return;
    }

    // Derive wallet address
    const normalizedKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);
    const account = privateKeyToAccount(normalizedKey);
    const walletAddress = account.address;

    const baseUrl = ARENA_BASE_URL();

    // Register agent with Arena
    const registerRes = await fetch(`${baseUrl}/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agentName,
        handle: agentHandle,
        address: walletAddress,
      }),
    });

    if (!registerRes.ok) {
      const body = (await registerRes.json().catch(() => ({}))) as Record<string, unknown>;
      throw new Error(
        `Agent registration failed (${registerRes.status}): ${body.message ?? registerRes.statusText}`
      );
    }

    const agentData = (await registerRes.json()) as {
      agentId: string;
      apiKey: string;
      verificationCode: string;
    };

    res.json({
      agentId: agentData.agentId,
      apiKey: agentData.apiKey,
      verificationCode: agentData.verificationCode,
      walletAddress,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Agent registration failed";
    console.error("Register-agent error:", error);
    res.status(500).json({ error: msg });
  }
});

/**
 * Step 2: Complete onboarding after agent has been claimed.
 * Registers for perps, runs EIP-712 auth flow, enables HIP-3,
 * encrypts & stores credentials.
 */
router.post("/onboard/complete", requireAuth, async (req, res) => {
  try {
    const { privateKey, arenaApiKey } = req.body as {
      privateKey?: string;
      arenaApiKey?: string;
    };
    if (!privateKey) {
      res.status(400).json({ error: "Private key is required" });
      return;
    }
    if (!arenaApiKey) {
      res.status(400).json({ error: "Arena API key is required" });
      return;
    }

    const userId = req.user!.userId;

    // Derive wallet address
    const normalizedKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);
    const account = privateKeyToAccount(normalizedKey);
    const walletAddress = account.address;

    const baseUrl = ARENA_BASE_URL();
    const arenaHeaders = {
      "Content-Type": "application/json",
      "x-api-key": arenaApiKey,
    };

    // 1. Register for perps
    const perpRes = await fetch(`${baseUrl}/agents/perp/register`, {
      method: "POST",
      headers: arenaHeaders,
      body: JSON.stringify({ provider: "HYPERLIQUID" }),
    });

    if (!perpRes.ok) {
      const body = (await perpRes.json().catch(() => ({}))) as Record<string, unknown>;
      throw new Error(
        `Perp registration failed (${perpRes.status}): ${body.message ?? perpRes.statusText}`
      );
    }

    // 2. Run 4-step EIP-712 auth flow
    const walletClient = createWalletClient({
      account,
      chain: arbitrum,
      transport: http(),
    });

    const authSteps = [
      "accept-terms",
      "approve-agent",
      "set-referrer",
      "approve-builder-fee",
    ];

    for (const step of authSteps) {
      // Get payload
      const payloadRes = await fetch(`${baseUrl}/agents/perp/auth/${step}/payload`, {
        method: "POST",
        headers: arenaHeaders,
        body: JSON.stringify({ mainWalletAddress: walletAddress }),
      });

      if (!payloadRes.ok) {
        const text = await payloadRes.text().catch(() => "");
        throw new Error(`Auth step ${step} payload failed: ${payloadRes.status} ${text}`);
      }

      const payload = (await payloadRes.json()) as {
        domain: Record<string, unknown>;
        types: Record<string, { name: string; type: string }[]>;
        primaryType: string;
        message: Record<string, unknown>;
        metadata?: unknown;
      };

      // Sign EIP-712
      const { EIP712Domain: _removed, ...typesWithoutDomain } = payload.types;

      const signature = await signTypedData(walletClient as any, {
        account,
        domain: payload.domain as any,
        types: typesWithoutDomain as any,
        primaryType: payload.primaryType,
        message: payload.message as Record<string, unknown>,
      });

      // Submit
      const submitRes = await fetch(`${baseUrl}/agents/perp/auth/${step}/submit`, {
        method: "POST",
        headers: arenaHeaders,
        body: JSON.stringify({
          mainWalletAddress: walletAddress,
          signature,
          metadata: payload.metadata,
        }),
      });

      if (!submitRes.ok) {
        const text = await submitRes.text().catch(() => "");
        throw new Error(`Auth step ${step} submit failed: ${submitRes.status} ${text}`);
      }
    }

    // 3. Enable HIP-3
    await fetch(`${baseUrl}/agents/perp/auth/enable-hip3`, {
      method: "POST",
      headers: arenaHeaders,
    });

    // 4. Encrypt & store credentials
    saveCredentials(userId, walletAddress, privateKey, arenaApiKey);

    // 5. Return updated user
    const user = getPublicUser(userId);
    res.json({ user, walletAddress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onboarding completion failed";
    console.error("Onboard-complete error:", error);
    res.status(500).json({ error: msg });
  }
});

export default router;
