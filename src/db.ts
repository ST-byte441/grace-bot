import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

export const db: DatabaseType = new Database('grace-bot.db'); // database file named grace-bot.db using better-sqlite3
db.pragma('journal_mode = WAL'); // Write-ahead logging for better concurrency/reliability

db.exec(` 
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message TEXT NOT NULL,
  role_id TEXT,
  cron TEXT NOT NULL,
  tz TEXT NOT NULL DEFAULT 'UTC',
  created_by TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
