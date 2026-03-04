import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: number;
  username: string;
  role: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not configured");
  return secret;
}

export function signToken(user: { id: number; username: string; role: string }): string {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    getSecret(),
    { expiresIn: "7d" },
  );
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, getSecret()) as AuthUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}