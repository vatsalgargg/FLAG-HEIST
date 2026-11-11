import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

// ── 1. TEAMS TABLE ────────────────────────────────────────────────────────────
// Accounts are provisioned by organisers. member_emails JSON's first entry is the team leader
// and is the only email accepted for team login; keep it unique across teams.
export const teams = sqliteTable(
  'teams',
  {
    id: text('id')
      .$defaultFn(randomUUID)
      .primaryKey(),
    teamName: text('team_name').notNull().unique(),
    memberEmails: text('member_emails', { mode: 'json' }).$type<string[]>().notNull(),
    teamSize: integer('team_size').notNull(),
    passwordHash: text('password_hash').notNull(),
    authVersion: integer('auth_version').default(0).notNull(),
    acceptedRulesAt: integer('accepted_rules_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(unixepoch('subsec') * 1000)`)
      .notNull(),
  },
  (table) => [
    index('idx_teams_team_name').on(table.teamName),
  ]
);

// ── 2. CHALLENGES TABLE ───────────────────────────────────────────────────────
// "We hash flags at rest, even though they're not passwords, so a database leak
// doesn't hand out every flag directly — cross-reference with /docs for the
// per-challenge plaintext flags kept privately outside the database entirely."
export const challenges = sqliteTable('challenges', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull(), // 'intro' | 'progressive' | 'final'
  points: integer('points').notNull(), // 15 for 1-12, 20 for 13 (200 total)
  flagHash: text('flag_hash').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
});

// ── 3. SOLVES TABLE ───────────────────────────────────────────────────────────
// "This UNIQUE constraint is the entire mechanism that prevents a resubmitted
// correct flag from being scored twice. Application code should attempt the
// INSERT and simply catch a unique-violation error as 'already solved' — never do
// a SELECT-then-INSERT check, which is a race condition under concurrent load."
//
// "ON DELETE RESTRICT (not CASCADE): during a live event we never want an
// accidental delete to silently wipe related scoring history; deletions should
// fail loudly and require a deliberate override."
export const solves = sqliteTable(
  'solves',
  {
    id: text('id')
      .$defaultFn(randomUUID)
      .primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'restrict' }),
    solvedAt: integer('solved_at', { mode: 'timestamp_ms' })
      .default(sql`(unixepoch('subsec') * 1000)`)
      .notNull(),
  },
  (table) => [
    unique('uq_solves_team_challenge').on(table.teamId, table.challengeId),
    index('idx_solves_team_id').on(table.teamId),
    index('idx_solves_challenge_id').on(table.challengeId),
  ]
);

// ── 4. HINTS TABLE ────────────────────────────────────────────────────────────
// Holds available hints per challenge and the loss-based point penalty cost for revealing.
export const hints = sqliteTable('hints', {
  id: text('id')
    .$defaultFn(randomUUID)
    .primaryKey(),
  challengeId: integer('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'restrict' }),
  cost: integer('cost').notNull(),
  content: text('content').notNull(),
  displayOrder: integer('display_order').notNull(),
});

// ── 5. HINTS_REVEALED TABLE ───────────────────────────────────────────────────
// "Same idempotency pattern as solves. A hint's point cost is deducted exactly
// once per team, the moment this row is first successfully inserted — never on
// repeated requests to view an already-revealed hint."
export const hintsRevealed = sqliteTable(
  'hints_revealed',
  {
    id: text('id')
      .$defaultFn(randomUUID)
      .primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    hintId: text('hint_id')
      .notNull()
      .references(() => hints.id, { onDelete: 'restrict' }),
    revealedAt: integer('revealed_at', { mode: 'timestamp_ms' })
      .default(sql`(unixepoch('subsec') * 1000)`)
      .notNull(),
  },
  (table) => [
    unique('uq_hints_revealed_team_hint').on(table.teamId, table.hintId),
    index('idx_hints_revealed_team_id').on(table.teamId),
  ]
);

// ── 6. SCORE_LOG TABLE (APPEND-ONLY) ──────────────────────────────────────────
// "This table is APPEND-ONLY — rows are never updated or deleted, only inserted.
// A team's displayed score is always DERIVED by summing this table, never stored
// as a single mutable column anywhere. This gives us a full audit trail for free:
// if a team disputes their score, the answer is always 'read every row for that
// team_id', not 'trust whatever a score column currently says'. Scoring is
// loss-based (every team starts at 200 points per the event rules), so a team's
// current score = 200 + SUM(score_log.delta) for that team — hint costs and any
// unsolved-challenge deductions are negative deltas; solving a challenge simply
// means no deduction is ever logged for it."
export const scoreLog = sqliteTable(
  'score_log',
  {
    id: text('id')
      .$defaultFn(randomUUID)
      .primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    actor: text('actor').notNull(), // 'system' | admin username
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(unixepoch('subsec') * 1000)`)
      .notNull(),
  },
  (table) => [
    index('idx_score_log_team_id').on(table.teamId),
  ]
);

// ── 7. ADMIN_USERS TABLE ──────────────────────────────────────────────────────
// "Kept entirely separate from the teams table on purpose — admin auth must never
// share a code path, secret, or table with participant auth, so a bug or leak in
// one can't compromise the other."
export const adminUsers = sqliteTable('admin_users', {
  id: text('id')
    .$defaultFn(randomUUID)
    .primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('admin').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(unixepoch('subsec') * 1000)`)
    .notNull(),
});

// ── 8. ANNOUNCEMENTS TABLE ───────────────────────────────────────────────────
// "Organiser-to-participant broadcast channel. Cached in Redis with a short TTL
// (10s) to absorb polling from 20,000 concurrent participants without hitting SQLite."
export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id')
      .$defaultFn(randomUUID)
      .primaryKey(),
    message: text('message').notNull(),
    severity: text('severity').notNull(), // 'info' | 'warning' | 'critical'
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(unixepoch('subsec') * 1000)`)
      .notNull(),
    createdBy: text('created_by').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  },
  (table) => [
    index('idx_announcements_is_active').on(table.isActive),
    index('idx_announcements_created_at').on(table.createdAt),
  ]
);
