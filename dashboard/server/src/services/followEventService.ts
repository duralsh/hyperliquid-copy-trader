import { getDb } from "./db.js";
import type { FollowEvent } from "../../../shared/types.js";

export function insertFollowEvent(
  userId: number,
  action: FollowEvent["action"],
  targetWallet: string,
  previousWallet?: string,
): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO follow_events (user_id, action, target_wallet, previous_wallet, timestamp) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, action, targetWallet, previousWallet ?? null, Date.now());
}

export function getFollowEvents(userId: number, limit = 50): FollowEvent[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, action, target_wallet, previous_wallet, timestamp FROM follow_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?"
  ).all(userId, limit) as { id: number; action: string; target_wallet: string; previous_wallet: string | null; timestamp: number }[];

  return rows.map((r) => ({
    id: r.id,
    action: r.action as FollowEvent["action"],
    targetWallet: r.target_wallet,
    previousWallet: r.previous_wallet,
    timestamp: r.timestamp,
  }));
}
