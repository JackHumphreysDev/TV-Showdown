import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.env.DB_PATH || 'data/tv-showdown.sqlite');
mkdirSync(resolve(path, '..'), { recursive: true });
export const db = new DatabaseSync(path);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL, colour TEXT NOT NULL DEFAULT '#F4C567', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL, region TEXT NOT NULL DEFAULT 'GB', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS memberships (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','member')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(group_id, account_id)
);
CREATE TABLE IF NOT EXISTS invites (
  code_hash TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('movie','series')),
  year INTEGER, tmdb_id INTEGER, poster_path TEXT, overview TEXT,
  status TEXT NOT NULL DEFAULT 'want' CHECK(status IN ('want','watching','watched')),
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_tmdb_unique ON watchlist(account_id, kind, tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS spin_sessions (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES accounts(id),
  idempotency_key TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active',
  filter TEXT NOT NULL, selected_profiles TEXT NOT NULL, eligible_snapshot TEXT NOT NULL,
  winner_profile_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, creator_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS spin_results (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES spin_sessions(id) ON DELETE CASCADE,
  watchlist_item_id TEXT, profile_name TEXT NOT NULL, title TEXT NOT NULL,
  kind TEXT NOT NULL, year INTEGER, tmdb_id INTEGER, poster_path TEXT, overview TEXT,
  state TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS spin_sessions_group ON spin_sessions(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spin_results_session ON spin_results(session_id, created_at DESC);
`);

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const value = fn(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
