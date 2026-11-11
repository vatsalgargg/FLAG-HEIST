import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import * as schema from './schema';

export * from './schema';

mkdirSync(path.dirname(config.databasePath), { recursive: true });
export const sqlite = new Database(config.databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');
export const db = drizzle(sqlite, { schema });
export const closeDatabase = () => sqlite.close();

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    sqlite.prepare('SELECT 1').get();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Database unavailable' };
  }
}

export async function assertDatabaseConnection(): Promise<void> {
  const health = await checkDatabaseHealth();
  if (!health.ok) throw new Error(`SQLite unavailable: ${health.error}`);
  console.log('[DB] SQLite ready.');
}
