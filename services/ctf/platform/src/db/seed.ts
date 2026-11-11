/**
 * Database Seed Script
 *
 * Populates initial data for the 13 ROOT CTF challenges and creates a local development
 * administrator account.
 *
 * IDEMPOTENCY:
 * This script is fully idempotent. Running it repeatedly uses `ON CONFLICT DO UPDATE`
 * to safely refresh challenge metadata without throwing duplicate key errors.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sql, eq, and } from 'drizzle-orm';
import { db, closeDatabase } from './index';
import { challenges, adminUsers, hints, hintsRevealed } from './schema';
import { config } from '../config';
import { INITIAL_HINTS } from './hintContent';

/**
 * Computes a salted SHA-256 hash of a flag using the event pepper.
 */
export function computeFlagHash(rawFlag: string, pepper: string): string {
  return crypto.createHash('sha256').update(`${rawFlag}:${pepper}`).digest('hex');
}

const PLACEHOLDER_FLAG_VALUE = 'PLACEHOLDER_FLAG_DO_NOT_USE';

// Real verified flags for all 13 ROOT CTF challenges
export const REAL_CHALLENGE_FLAGS: Record<number, string> = {
  1: 'ROOT{v3yr4_st4g1ng_s1t3_l34k_7f3a2c91}',
  2: 'ROOT{sm4ll_pr1m3_f4ct0r_8921}',
  3: 'ROOT{tw1tt3r_0s1nt_tr41l_3th4n_c0l3_9a7b}',
  4: 'ROOT{3mpl0y33_p0rt4l_d3f4ult_cr3ds_881a}',
  5: 'ROOT{autumn2026}',
  6: 'ROOT{st3g0_1m4g3_ph0t0_l34k_v3yr4_4f2d}',
  7: 'ROOT{1nv01c3_tr4nsf0rm_1d0r_9104a}',
  8: 'ROOT{l3g4cy_sync_uns4f3_byp4ss_78a1}',
  9: 'ROOT{s3ss10n_ch3cksum_f0rg3ry_b73c}',
  10: 'ROOT{c0nf1g_b4ckup_tr4v3rs4l_98a2}',
  11: 'ROOT{cl0ck_sk3w_l0g_c0rr3l4t10n_9b4e1a}',
  12: 'ROOT{d14gn0st1cs_c0mm4nd_1nj_41b7}',
  13: 'ROOT{ssrf_ch41n_4dm1n_c0v3rup_99f1}',
};

// ── The 13 Competition Challenges ─────────────────────────────────────────────
const INITIAL_CHALLENGES = [
  { id: 1, name: 'The Forgotten Staging Site', tier: 'intro', points: 15 },
  { id: 2, name: 'The Broken Lock', tier: 'intro', points: 15 },
  { id: 3, name: 'The Twitter Trail', tier: 'intro', points: 15 },
  { id: 4, name: 'The Employee Portal', tier: 'progressive', points: 15 },
  { id: 5, name: 'Who Is Ethan Cole?', tier: 'progressive', points: 15 },
  { id: 6, name: 'The Leaked Photo', tier: 'progressive', points: 15 },
  { id: 7, name: 'The Invoice Trail', tier: 'progressive', points: 15 },
  { id: 8, name: 'The Internal Dashboard', tier: 'progressive', points: 15 },
  { id: 9, name: 'The Session Bug', tier: 'progressive', points: 15 },
  { id: 10, name: 'The Config Backup', tier: 'progressive', points: 15 },
  { id: 11, name: 'The Debug Trace', tier: 'progressive', points: 15 },
  { id: 12, name: 'The Diagnostics Backdoor', tier: 'progressive', points: 15 },
  { id: 13, name: 'The Admin Cover-Up (Final)', tier: 'final', points: 20 },
];



async function seed(): Promise<void> {
  const line = '='.repeat(80);
  console.log(`\n${line}`);
  console.log('[SEED] Starting ROOT CTF database seeding...');
  console.log(line);

  const placeholderHash = computeFlagHash(PLACEHOLDER_FLAG_VALUE, config.flagPepper);

  // 1. Seed Challenges
  console.log(`[SEED] Upserting ${INITIAL_CHALLENGES.length} challenges (Total Points: 200)...`);
  for (const ch of INITIAL_CHALLENGES) {
    const realFlag = REAL_CHALLENGE_FLAGS[ch.id];
    const flagHash = realFlag
      ? computeFlagHash(realFlag, config.flagPepper)
      : placeholderHash;

    await db
      .insert(challenges)
      .values({
        id: ch.id,
        name: ch.name,
        tier: ch.tier,
        points: ch.points,
        flagHash,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: challenges.id,
        set: {
          name: sql`excluded.name`,
          tier: sql`excluded.tier`,
          points: sql`excluded.points`,
          flagHash: sql`excluded.flag_hash`,
        },
      });

    const statusLabel = realFlag ? 'REAL FLAG ACTIVE' : 'PLACEHOLDER';
    console.log(`  ✓ Challenge ${ch.id.toString().padStart(2, '0')}: "${ch.name}" [${ch.tier}, ${ch.points} pts] -> [${statusLabel}]`);
  }

  // 2. Seed Hints
  console.log(`\n[SEED] Upserting hints for all ${INITIAL_CHALLENGES.length} challenges...`);
  for (const h of INITIAL_HINTS) {
    const [existing] = await db.select({ id: hints.id }).from(hints).where(and(eq(hints.challengeId, h.challengeId), eq(hints.displayOrder, h.displayOrder))).limit(1);
    if (!existing) await db.insert(hints).values(h);
    else {
      const [purchase] = await db.select({ id: hintsRevealed.id }).from(hintsRevealed).where(eq(hintsRevealed.hintId, existing.id)).limit(1);
      // Preserve purchased hint prices and content; refresh only unpurchased seed metadata.
      if (!purchase) await db.update(hints).set({ content: h.content, cost: h.cost }).where(eq(hints.id, existing.id));
    }
  }
  console.log(`  ✓ Ensured ${INITIAL_HINTS.length} original arena hints.`);

  // 3. Seed Development Admin User
  console.log(`\n[SEED] Seeding local development admin user (${config.adminSeedUsername})...`);
  const adminPasswordHash = await bcrypt.hash(config.adminSeedPassword, 10);

  await db
    .insert(adminUsers)
    .values({
      username: config.adminSeedUsername,
      passwordHash: adminPasswordHash,
      role: 'admin',
    })
    .onConflictDoNothing({ target: adminUsers.username });

  console.log(`  ✓ Admin user "${config.adminSeedUsername}" upserted.`);
  console.warn('  ⚠️  Note: This admin account is for local development only. Never use default credentials in production.');

  console.log(`\n[SEED] SUCCESS: Seeding completed successfully!`);
  console.log(`${line}\n`);
}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seed()
    .catch((err) => {
      console.error('[SEED] Fatal error during database seed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDatabase();
    });
}
