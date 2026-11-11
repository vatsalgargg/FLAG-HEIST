import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sqlite, closeDatabase } from './index';

async function verify(): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'flagheist-restore-'));
  try {
    const file = path.join(directory, 'restored.db');
    await sqlite.backup(file);
    const restored = new Database(file, { readonly: true });
    try {
      assert.equal(restored.pragma('integrity_check', { simple: true }), 'ok');
      assert.deepEqual(restored.pragma('foreign_key_check'), []);
      for (const { name } of sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) {
        assert.match(name, /^[a-zA-Z0-9_]+$/);
        const rows = (database: Database.Database) => database.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all();
        assert.deepEqual(rows(restored), rows(sqlite), `Restore changed ${name}`);
      }
      console.log('PASS: SQLite online backup restores every table, preserves all rows, and passes integrity/foreign-key checks.');
    } finally { restored.close(); }
  } finally { closeDatabase(); rmSync(directory, { recursive: true, force: true }); }
}
verify().catch(err => { console.error(err); process.exitCode = 1; });
