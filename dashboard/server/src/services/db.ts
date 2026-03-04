import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { encrypt } from "./crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../../../data/dashboard.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    wallet_address TEXT,
    private_key_encrypted TEXT,
    private_key_iv TEXT,
    private_key_tag TEXT,
    arena_api_key_encrypted TEXT,
    arena_api_key_iv TEXT,
    arena_api_key_tag TEXT,
    arena_agent_id TEXT,
    onboarded_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, address),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export function getDb(): Database.Database {
  return db;
}

/**
 * Bootstrap admin user from env vars on startup.
 * Creates admin user with ADMIN_USERNAME/ADMIN_PASSWORD and migrates
 * existing MAIN_WALLET_PRIVATE_KEY/ARENA_API_KEY into encrypted DB record.
 */
export function bootstrapAdmin(): void {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.log("[auth] No ADMIN_USERNAME/ADMIN_PASSWORD set — skipping admin bootstrap");
    return;
  }

  // Migration: rename old admin user if it exists and username changed
  const oldAdmin = db.prepare("SELECT id, username FROM users WHERE role = 'admin'").get() as { id: number; username: string } | undefined;

  if (oldAdmin && oldAdmin.username !== username) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?").run(username, hash, oldAdmin.id);
    console.log(`[auth] Migrated admin "${oldAdmin.username}" → "${username}" (id=${oldAdmin.id})`);
  }

  // Delete all non-admin users
  const deleted = db.prepare("DELETE FROM users WHERE role != 'admin'").run();
  if (deleted.changes > 0) {
    console.log(`[auth] Cleaned up ${deleted.changes} non-admin user(s)`);
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  if (existing) {
    // Update password in case it changed
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, existing.id);
    console.log(`[auth] Admin user "${username}" ready (id=${existing.id})`);

    // Migrate credentials from env if not already onboarded
    const row = db.prepare("SELECT onboarded_at FROM users WHERE id = ?").get(existing.id) as { onboarded_at: string | null } | undefined;
    const privateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
    const arenaApiKey = process.env.ARENA_API_KEY;
    const walletAddress = process.env.MAIN_WALLET_ADDRESS;

    if (!row?.onboarded_at && privateKey && arenaApiKey && walletAddress) {
      try {
        const pk = encrypt(privateKey);
        const ak = encrypt(arenaApiKey);
        db.prepare(`
          UPDATE users SET
            wallet_address = ?,
            private_key_encrypted = ?, private_key_iv = ?, private_key_tag = ?,
            arena_api_key_encrypted = ?, arena_api_key_iv = ?, arena_api_key_tag = ?,
            onboarded_at = datetime('now')
          WHERE id = ?
        `).run(
          walletAddress,
          pk.ciphertext, pk.iv, pk.tag,
          ak.ciphertext, ak.iv, ak.tag,
          existing.id
        );
        console.log(`[auth] Migrated existing credentials for admin "${username}"`);
      } catch (err) {
        console.error("[auth] Failed to migrate admin credentials:", err);
      }
    }
    return;
  }

  // Create new admin user
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')"
  ).run(username, hash);

  const userId = result.lastInsertRowid as number;
  console.log(`[auth] Created admin user "${username}" (id=${userId})`);

  // Migrate existing credentials from env
  const privateKey = process.env.MAIN_WALLET_PRIVATE_KEY;
  const arenaApiKey = process.env.ARENA_API_KEY;
  const walletAddress = process.env.MAIN_WALLET_ADDRESS;

  if (privateKey && arenaApiKey && walletAddress) {
    try {
      const pk = encrypt(privateKey);
      const ak = encrypt(arenaApiKey);
      db.prepare(`
        UPDATE users SET
          wallet_address = ?,
          private_key_encrypted = ?, private_key_iv = ?, private_key_tag = ?,
          arena_api_key_encrypted = ?, arena_api_key_iv = ?, arena_api_key_tag = ?,
          onboarded_at = datetime('now')
        WHERE id = ?
      `).run(
        walletAddress,
        pk.ciphertext, pk.iv, pk.tag,
        ak.ciphertext, ak.iv, ak.tag,
        userId
      );
      console.log(`[auth] Migrated existing credentials for admin "${username}"`);
    } catch (err) {
      console.error("[auth] Failed to migrate admin credentials:", err);
    }
  }
}
