import { mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { sqlite, closeDatabase } from './index';

async function backup(): Promise<void> {
  const directory = path.resolve(process.argv[2] || './backups');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const destination = path.join(directory, `flagheist-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  await sqlite.backup(`${destination}.tmp`);
  renameSync(`${destination}.tmp`, destination);
  console.log(`SQLite backup saved: ${destination}`);
}
backup().catch(err => { console.error(err); process.exitCode = 1; }).finally(closeDatabase);
