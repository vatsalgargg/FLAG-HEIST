import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, closeDatabase } from './index';

try {
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  console.log('[DB] SQLite migrations applied.');
} finally {
  closeDatabase();
}
