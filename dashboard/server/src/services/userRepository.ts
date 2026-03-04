import bcrypt from "bcryptjs";
import { getDb } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  wallet_address: string | null;
  private_key_encrypted: string | null;
  private_key_iv: string | null;
  private_key_tag: string | null;
  arena_api_key_encrypted: string | null;
  arena_api_key_iv: string | null;
  arena_api_key_tag: string | null;
  arena_agent_id: string | null;
  onboarded_at: string | null;
  created_at: string;
}

interface FavoriteRow {
  user_id: number;
  address: string;
  added_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  role: string;
  walletAddress: string | null;
  onboarded: boolean;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    walletAddress: row.wallet_address,
    onboarded: row.onboarded_at !== null,
  };
}

export function createUser(username: string, password: string, role = "user"): PublicUser {
  const hash = bcrypt.hashSync(password, 10);
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
  ).run(username, hash, role);
  return {
    id: result.lastInsertRowid as number,
    username,
    role,
    walletAddress: null,
    onboarded: false,
  };
}

export function findByUsername(username: string): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function findById(id: number): UserRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getPublicUser(id: number): PublicUser | undefined {
  const row = findById(id);
  return row ? toPublicUser(row) : undefined;
}

export function verifyPassword(row: UserRow, password: string): boolean {
  return bcrypt.compareSync(password, row.password_hash);
}

export function saveCredentials(
  userId: number,
  walletAddress: string,
  privateKey: string,
  arenaApiKey: string,
  agentId?: string,
): void {
  const pk = encrypt(privateKey);
  const ak = encrypt(arenaApiKey);
  const db = getDb();
  db.prepare(`
    UPDATE users SET
      wallet_address = ?,
      private_key_encrypted = ?, private_key_iv = ?, private_key_tag = ?,
      arena_api_key_encrypted = ?, arena_api_key_iv = ?, arena_api_key_tag = ?,
      arena_agent_id = ?,
      onboarded_at = datetime('now')
    WHERE id = ?
  `).run(
    walletAddress,
    pk.ciphertext, pk.iv, pk.tag,
    ak.ciphertext, ak.iv, ak.tag,
    agentId ?? null,
    userId,
  );
}

export function getUserCredentials(userId: number): {
  walletAddress: string;
  privateKey: string;
  arenaApiKey: string;
} | null {
  const row = findById(userId);
  if (
    !row ||
    !row.private_key_encrypted || !row.private_key_iv || !row.private_key_tag ||
    !row.arena_api_key_encrypted || !row.arena_api_key_iv || !row.arena_api_key_tag ||
    !row.wallet_address
  ) {
    return null;
  }
  return {
    walletAddress: row.wallet_address,
    privateKey: decrypt(row.private_key_encrypted, row.private_key_iv, row.private_key_tag),
    arenaApiKey: decrypt(row.arena_api_key_encrypted, row.arena_api_key_iv, row.arena_api_key_tag),
  };
}

export function markOnboarded(userId: number): void {
  const db = getDb();
  db.prepare("UPDATE users SET onboarded_at = datetime('now') WHERE id = ?").run(userId);
}

export function addFavorite(userId: number, address: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO favorites (user_id, address) VALUES (?, ?)"
  ).run(userId, address.toLowerCase());
}

export function removeFavorite(userId: number, address: string): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM favorites WHERE user_id = ? AND address = ?"
  ).run(userId, address.toLowerCase());
}

export function getFavorites(userId: number): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT address FROM favorites WHERE user_id = ? ORDER BY added_at DESC"
  ).all(userId) as FavoriteRow[];
  return rows.map((r) => r.address);
}
