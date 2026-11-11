/**
 * Score Calculation & Challenge State Utilities
 *
 * Provides core calculation functions for team scores and solve state.
 *
 * ARCHITECTURAL DESIGN: SINGLE SOURCE OF TRUTH
 * A team's current score is ALWAYS derived from the append-only `score_log` table:
 *   Current Score = 200 + SUM(score_log.delta WHERE team_id = teamId)
 *
 * Why never read from a stored mutable "score" column?
 * 1. Immutability & Auditability: If an organiser or team disputes their standing,
 *    we never say "trust this number in the database". We inspect the complete history
 *    of solve events, hint deductions, and admin adjustments.
 * 2. Caching Target: The derived score is what gets placed into the Redis cache.
 *    The database is the immutable ledger; Redis is the transient, fast read-layer.
 */

import { eq, sql, asc } from 'drizzle-orm';
import { db, scoreLog, solves, hintsRevealed, challenges } from '../db';

/**
 * Computes the live derived score for a specific team from the append-only score_log.
 * Every team begins with a baseline of 200 points per event rules.
 * Deltas for hints and deductions are negative numbers.
 *
 * @param teamId UUID of the team.
 * @returns The current score integer (e.g., 200, 195, 180).
 */
export async function getTeamScore(teamId: string): Promise<number> {
  const result = await db
    .select({
      totalDelta: sql<number>`COALESCE(SUM(${scoreLog.delta}), 0)`,
    })
    .from(scoreLog)
    .where(eq(scoreLog.teamId, teamId));

  const totalDelta = result[0]?.totalDelta || 0;
  return 200 + totalDelta;
}

/**
 * Retrieves the set of challenge IDs that a team has solved.
 *
 * PERFORMANCE NOTE:
 * This query relies on the `idx_solves_team_id` index created in Prompt 2.
 * Even with thousands of concurrent teams, looking up solves for a single team
 * is a high-speed indexed B-tree index scan returning <13 rows.
 *
 * @param teamId UUID of the team.
 * @returns Set of integer challenge IDs (e.g., Set { 1, 2, 4 }).
 */
export async function getTeamSolvedChallengeIds(teamId: string): Promise<Set<number>> {
  const rows = await db
    .select({ challengeId: solves.challengeId })
    .from(solves)
    .where(eq(solves.teamId, teamId));

  const solvedSet = new Set<number>();
  for (const row of rows) {
    solvedSet.add(row.challengeId);
  }
  return solvedSet;
}

/**
 * Retrieves the set of hint IDs that a team has already unlocked.
 *
 * PERFORMANCE NOTE:
 * Relies on the `idx_hints_revealed_team_id` index for instant per-team lookups.
 *
 * @param teamId UUID of the team.
 * @returns Set of hint UUID strings.
 */
export async function getTeamRevealedHintIds(teamId: string): Promise<Set<string>> {
  const rows = await db
    .select({ hintId: hintsRevealed.hintId })
    .from(hintsRevealed)
    .where(eq(hintsRevealed.teamId, teamId));

  const hintSet = new Set<string>();
  for (const row of rows) {
    hintSet.add(row.hintId);
  }
  return hintSet;
}

// ── In-Memory Challenge Cache ────────────────────────────────────────────────
// Challenge metadata (id, name, tier, points, isActive) is static throughout the
// competition, but isActive can be toggled by admins during an incident.
export interface StaticChallenge {
  id: number;
  name: string;
  tier: string;
  points: number;
  isActive: boolean;
}

let cachedChallenges: StaticChallenge[] | null = null;
let challengeCacheExpiresAt = 0;
const CHALLENGE_CACHE_TTL_MS = 1000; // 5 minutes

/**
 * Instantly invalidates the in-memory challenge cache when an admin toggles a challenge.
 */
export function invalidateChallengeCache(): void {
  cachedChallenges = null;
  challengeCacheExpiresAt = 0;
}

/**
 * Returns all 13 challenges (active and inactive), cached in memory.
 * NEVER returns flag hashes to callers.
 */
export async function getAllChallenges(): Promise<StaticChallenge[]> {
  const now = Date.now();
  if (cachedChallenges && now < challengeCacheExpiresAt) {
    return cachedChallenges;
  }

  const rows = await db
    .select({
      id: challenges.id,
      name: challenges.name,
      tier: challenges.tier,
      points: challenges.points,
      isActive: challenges.isActive,
    })
    .from(challenges)
    .orderBy(asc(challenges.id));

  cachedChallenges = rows;
  challengeCacheExpiresAt = now + CHALLENGE_CACHE_TTL_MS;
  return rows;
}

/**
 * Returns only active challenges.
 */
export async function getActiveChallenges(): Promise<StaticChallenge[]> {
  const all = await getAllChallenges();
  return all.filter((c) => c.isActive);
}
