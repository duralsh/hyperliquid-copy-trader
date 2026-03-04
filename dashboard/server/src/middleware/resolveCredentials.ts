import type { Request, Response, NextFunction } from "express";
import { getUserCredentials } from "../services/userRepository.js";
import type { UserContext } from "../services/userContext.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

export function resolveCredentials(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const creds = getUserCredentials(req.user.userId);
  if (!creds) {
    res.status(403).json({ error: "Onboarding not completed" });
    return;
  }

  req.userContext = {
    userId: req.user.userId,
    username: req.user.username,
    walletAddress: creds.walletAddress,
    privateKey: creds.privateKey,
    arenaApiKey: creds.arenaApiKey,
  };

  next();
}
