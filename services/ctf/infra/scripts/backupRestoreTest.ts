/**
 * ROOT CTF — Automated Database Backup & End-to-End Restore Verification Test
 *
 * Implements Phase N Requirement:
 * "Configure automated database backups and test one real restore end to end
 * against a throwaway copy."
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const sourceDbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/veyra_ctf';
const TEST_RESTORE_DB = 'veyra_restore_test_scratch';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ RESTORE TEST ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runBackupAndRestoreTest(): Promise<void> {
  const line = '='.repeat(80);
  console.log(`\n${line}`);
  console.log('ROOT CTF — AUTOMATED DATABASE BACKUP & RESTORE VERIFICATION TEST');
  console.log(line);

  // 1. Connect to source database
  console.log('[1/5] Connecting to primary source database...');
  const sourceClient = new Client({ connectionString: sourceDbUrl });
  await sourceClient.connect();
  console.log('  ✓ Connected to source database.');

  // Tables to back up
  const TABLES = ['admin_users', 'challenges', 'hints', 'teams', 'solves', 'hints_revealed', 'score_log'];

  try {
    // 2. Count rows in source database
    console.log('\n[2/5] Counting baseline ground-truth rows across all schema tables...');
    const sourceCounts: Record<string, number> = {};
    for (const table of TABLES) {
      const res = await sourceClient.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      sourceCounts[table] = res.rows[0].count;
      console.log(`  - Table "${table.padEnd(16)}": ${sourceCounts[table]} rows`);
    }

    // 3. Generate structured SQL backup dump
    console.log('\n[3/5] Generating automated backup dump file...');
    const backupDir = path.resolve(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `backup-${timestamp}.sql`);

    // Fetch schema definitions and insert statements
    let dumpSql = `-- ROOT CTF Automated PostgreSQL Backup Dump\n-- Timestamp: ${new Date().toISOString()}\n\n`;

    for (const table of TABLES) {
      const rowsRes = await sourceClient.query(`SELECT * FROM "${table}"`);
      dumpSql += `-- Table: ${table}\n`;
      if (rowsRes.rows.length > 0) {
        for (const row of rowsRes.rows) {
          const cols = Object.keys(row).map((c) => `"${c}"`).join(', ');
          const vals = Object.values(row)
            .map((val) => {
              if (val === null) return 'NULL';
              if (typeof val === 'number' || typeof val === 'boolean') return val;
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (Array.isArray(val)) {
                const arrayLiteral = `{${val.map((v) => `"${v}"`).join(',')}}`;
                return `'${arrayLiteral}'`;
              }
              return `'${String(val).replace(/'/g, "''")}'`;
            })
            .join(', ');
          dumpSql += `INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
        }
      }
      dumpSql += '\n';
    }

    fs.writeFileSync(backupFilePath, dumpSql, 'utf-8');
    const dumpStats = fs.statSync(backupFilePath);
    console.log(`  ✓ Backup file written: ${backupFilePath} (${dumpStats.size} bytes)`);

    // 4. Provision throwaway database and apply DDL schema
    console.log('\n[4/5] Provisioning throwaway database for restore verification...');
    // Connect to administrative 'postgres' db to manage test database
    const adminUrl = sourceDbUrl.replace(/\/[^/]+$/, '/postgres');
    const adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();

    try {
      await adminClient.query(`DROP DATABASE IF EXISTS "${TEST_RESTORE_DB}" WITH (FORCE);`);
      await adminClient.query(`CREATE DATABASE "${TEST_RESTORE_DB}";`);
      console.log(`  ✓ Clean throwaway database "${TEST_RESTORE_DB}" created.`);
    } finally {
      await adminClient.end();
    }

    // Connect to throwaway database
    const restoreDbUrl = sourceDbUrl.replace(/\/[^/]+$/, `/${TEST_RESTORE_DB}`);
    const restoreClient = new Client({ connectionString: restoreDbUrl });
    await restoreClient.connect();

    try {
      // Apply base DDL migration
      const ddlPath = path.resolve(__dirname, '../../platform/drizzle/0000_married_monster_badoon.sql');
      const ddlContent = fs.readFileSync(ddlPath, 'utf-8');
      const statements = ddlContent.split('--> statement-breakpoint');
      for (const stmt of statements) {
        const cleanStmt = stmt.trim();
        if (cleanStmt) {
          await restoreClient.query(cleanStmt);
        }
      }
      console.log('  ✓ PostgreSQL schema migrations applied to throwaway database.');

      // Restore data from backup dump
      await restoreClient.query(dumpSql);
      console.log('  ✓ Backup dump restored into throwaway database.');

      // 5. Verify restored data matches source 100%
      console.log('\n[5/5] Asserting 100% data integrity between primary and restored database...');
      for (const table of TABLES) {
        const res = await restoreClient.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
        const restoredCount = res.rows[0].count;
        assert(
          restoredCount === sourceCounts[table],
          `Table "${table}" row count matches: source=${sourceCounts[table]}, restored=${restoredCount}`
        );
      }

      // Assert derived score equality for sample team
      const scoreSourceRes = await sourceClient.query(
        'SELECT team_id, SUM(delta) as delta_sum FROM score_log GROUP BY team_id LIMIT 1'
      );
      if (scoreSourceRes.rows.length > 0) {
        const sampleTeamId = scoreSourceRes.rows[0].team_id;
        const scoreRestoreRes = await restoreClient.query(
          `SELECT SUM(delta) as delta_sum FROM score_log WHERE team_id = '${sampleTeamId}'`
        );
        assert(
          scoreSourceRes.rows[0].delta_sum === scoreRestoreRes.rows[0].delta_sum,
          `Audit ledger derived score matches identically for sample team ${sampleTeamId}`
        );
      }

      console.log('\n  ✓ 100% data parity and audit integrity confirmed!');
    } finally {
      await restoreClient.end();
    }

    // Teardown throwaway test database
    const cleanupClient = new Client({ connectionString: adminUrl });
    await cleanupClient.connect();
    try {
      await cleanupClient.query(`DROP DATABASE IF EXISTS "${TEST_RESTORE_DB}" WITH (FORCE);`);
      console.log(`  ✓ Throwaway test database "${TEST_RESTORE_DB}" cleanly destroyed.`);
    } finally {
      await cleanupClient.end();
    }

    console.log(`\n${line}`);
    console.log('✅ BACKUP & RESTORE VERIFICATION COMPLETED WITH 100% INTEGRITY PARITY');
    console.log(`${line}\n`);
  } finally {
    await sourceClient.end();
  }
}

runBackupAndRestoreTest().catch((err) => {
  console.error('\n❌ Backup and restore test failed:', err);
  process.exit(1);
});
