/**
 * Challenge 07 & 08 — Isolated SQLite Database Layer
 *
 * ARCHITECTURAL ISOLATION:
 * ==============================================================================
 * This database is strictly isolated from the scoring platform's PostgreSQL
 * database. It models Veyra Cloud Solutions' internal enterprise management &
 * billing platform.
 *
 * Concurrency & Zero-Budget Rationale:
 * SQLite with WAL (Write-Ahead Logging) is completely self-contained, embedded,
 * requires zero external database servers, and operates with sub-millisecond
 * latency for the 5,000–10,000 read queries per minute typical of CTF events.
 * ==============================================================================
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { deriveInvoiceId } from './transform';

export const CHALLENGE_07_FLAG = 'ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}';
export const CHALLENGE_08_FLAG = 'ROOT{l3g4cy_sync_uns4f3_byp4ss_78a1}';

export const PRIYA_CUSTOMER_ID = 1042;
export const TARGET_CUSTOMER_ID = 9104;

let dbInstance: DatabaseType | null = null;

export function getDatabase(dbPath?: string): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const resolvedPath = dbPath || process.env.PORTAL_DB_PATH || path.join(__dirname, '..', 'data', 'portal.db');

  // Ensure data directory exists if using file path
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  seedDatabase(db);

  dbInstance = db;
  return db;
}

export function initSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      plan_tier TEXT NOT NULL,
      account_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
      invoice_num INTEGER NOT NULL,
      amount REAL NOT NULL,
      issued_at TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      flag TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_notes (
      note_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export function seedDatabase(db: DatabaseType): void {
  const insertCustomer = db.prepare(`
    INSERT OR REPLACE INTO customers (customer_id, name, company, plan_tier, account_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertInvoice = db.prepare(`
    INSERT OR REPLACE INTO invoices (invoice_id, customer_id, invoice_num, amount, issued_at, description, status, flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAuditNote = db.prepare(`
    INSERT OR REPLACE INTO audit_notes (note_id, title, content, category, author, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const seedTx = db.transaction(() => {
    // 1. Priya's internal account
    insertCustomer.run(
      PRIYA_CUSTOMER_ID,
      'Priya Nair',
      'Veyra Internal Audit',
      'enterprise_internal',
      'active',
      '2025-01-10T08:00:00Z'
    );

    // 2. Target customer (Apex Sovereign Holdings - ID 9104)
    insertCustomer.run(
      TARGET_CUSTOMER_ID,
      'Apex Sovereign Holdings',
      'Apex Sovereign Ltd.',
      'sovereign_dedicated',
      'under_investigation',
      '2025-08-14T11:30:00Z'
    );

    // 3. Decoy realistic customers
    const decoys = [
      { id: 2018, name: 'Helios Energy Grid', comp: 'Helios Infrastructure Corp', plan: 'enterprise_cloud' },
      { id: 3055, name: 'Kestrel BioTech Labs', comp: 'Kestrel Therapeutics Inc', plan: 'pro_tier' },
      { id: 4410, name: 'Strata Financial Core', comp: 'Strata Global Holdings', plan: 'enterprise_dedicated' },
      { id: 5822, name: 'Aether Dynamics LLC', comp: 'Aether Dynamics Systems', plan: 'enterprise_cloud' },
      { id: 7701, name: 'Ironclad Defense Systems', comp: 'Ironclad Cyber LLC', plan: 'sovereign_dedicated' },
    ];

    for (const d of decoys) {
      insertCustomer.run(d.id, d.name, d.comp, d.plan, 'active', '2025-03-20T10:00:00Z');
    }

    // 4. Priya's 5 Invoices (makes transform pattern inferable across multiple samples)
    const priyaInvoices = [
      { num: 1, amount: 1420.50, date: '2026-06-15', desc: 'Q2 Cloud Security Audit Infrastructure Provisioning' },
      { num: 2, amount: 2890.00, date: '2026-07-15', desc: 'Monthly Log Storage Retention & Archival SLA' },
      { num: 3, amount: 980.25,  date: '2026-08-15', desc: 'Automated Vulnerability Scanner Core Seats' },
      { num: 4, amount: 3450.00, date: '2026-09-15', desc: 'Dedicated Virtual HSM Key Management Module' },
      { num: 5, amount: 1720.00, date: '2026-10-15', desc: 'Redundant Ingress Gateway & Transit VPC Peering' },
    ];

    for (const inv of priyaInvoices) {
      const invId = deriveInvoiceId(PRIYA_CUSTOMER_ID, inv.num);
      insertInvoice.run(invId, PRIYA_CUSTOMER_ID, inv.num, inv.amount, inv.date, inv.desc, 'paid', null);
    }

    // 5. Target Invoice for Apex Sovereign Holdings (Contains Challenge 7 Flag)
    const targetInvId = deriveInvoiceId(TARGET_CUSTOMER_ID, 1);
    insertInvoice.run(
      targetInvId,
      TARGET_CUSTOMER_ID,
      1,
      87500.00,
      '2026-11-01',
      `Confidential Settlement & Executive Retainer - Clearance: ${CHALLENGE_07_FLAG}`,
      'disputed',
      CHALLENGE_07_FLAG
    );

    // 6. Decoy invoices for other customers
    const decoyInvoices = [
      { custId: 2018, num: 1, amount: 12400.00, date: '2026-09-01', desc: 'Grid Load Balancer Tier 1 Provisioning' },
      { custId: 2018, num: 2, amount: 15300.00, date: '2026-10-01', desc: 'High Availability Multi-Region Cluster SLA' },
      { custId: 3055, num: 1, amount: 4800.00,  date: '2026-10-15', desc: 'Genomics Compute Cluster Node Allocation' },
      { custId: 4410, num: 1, amount: 32000.00, date: '2026-08-10', desc: 'Financial Ledger Consensus Subnet' },
      { custId: 4410, num: 2, amount: 28500.00, date: '2026-09-10', desc: 'Ultra-low Latency Market Feed Direct Connect' },
      { custId: 4410, num: 3, amount: 31200.00, date: '2026-10-10', desc: 'Regulatory Compliance Audit & Encryption Nodes' },
      { custId: 5822, num: 1, amount: 9200.00,  date: '2026-10-05', desc: 'Autonomous Flight Simulation GPU Instance' },
      { custId: 7701, num: 1, amount: 45000.00, date: '2026-09-20', desc: 'Zero-Trust Perimeter Air-Gap Gateway' },
      { custId: 7701, num: 2, amount: 48000.00, date: '2026-10-20', desc: 'Federal Cryptographic Key Lifecycle Module' },
    ];

    for (const d of decoyInvoices) {
      const invId = deriveInvoiceId(d.custId, d.num);
      insertInvoice.run(invId, d.custId, d.num, d.amount, d.date, d.desc, 'paid', null);
    }

    // 7. Audit notes providing in-app clue to Target Customer ID
    insertAuditNote.run(
      1,
      'AUD-2026-882: Escalation memo regarding disputed account billing',
      'Finance escalation: Customer ID 9104 (Apex Sovereign Holdings) submitted formal dispute on Invoice #1 amount ($87,500.00). Retainer record flagged for compliance review. Assigned auditor: Priya Nair.',
      'escalation',
      'Marc Vance (VP Finance)',
      '2026-11-02T09:15:00Z'
    );

    insertAuditNote.run(
      2,
      'AUD-2026-879: Routine internal audit checkpoint',
      'All internal auditor credentials and department accounts (ID: 1042) verified. Key rotation completed successfully.',
      'compliance',
      'Priya Nair',
      '2026-10-28T14:00:00Z'
    );

    insertAuditNote.run(
      3,
      'AUD-2026-865: Platform infrastructure update notice',
      'Billing export pipeline sync scheduled for end of month. Legacy internal services undergoing migration to v2 worker pools.',
      'operations',
      'DevOps Automated Monitor',
      '2026-10-15T18:30:00Z'
    );
  });

  seedTx();
}

/** Reset Challenge 7 state */
export function resetChallenge07(db: DatabaseType): void {
  db.exec(`
    DELETE FROM invoices;
    DELETE FROM customers;
    DELETE FROM audit_notes;
  `);
  seedDatabase(db);
}

/** Reset Challenge 8 state */
export function resetChallenge08(db: DatabaseType): void {
  // Challenge 8 uses static in-memory operational diagnostics; reset ensures DB & notes are synchronized
  resetChallenge07(db);
}
