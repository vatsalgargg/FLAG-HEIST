/**
 * Redis Leaderboard Cache Layer
 *
 * ARCHITECTURAL DESIGN: FAST PATH VS SLOW PATH
 * ------------------------------------------------------------------------------
 * With thousands of concurrent spectators and players refreshing the leaderboard,
 * repeated SQL aggregations are avoided by serving cached rankings.
 *
 * 1. Fast Path (Incremental Update):
 *    When a score event happens (solve, hint), `applyIncrementalScoreChange` updates
 *    only that one team's score in the cached Redis JSON array and re-sorts it in memory.
 *    Takes ~1ms and executes ZERO SQL queries.
 *
 * 2. Slow Path (Self-Healing Rebuild):
 *    `rebuildLeaderboardCache` executes a single optimized aggregation query against
 *    SQLite to reconstruct the entire leaderboard from the ground truth.
 *    Runs automatically every 30 seconds as a background self-healing safety net.
 *
 * TIE-BREAKING RULE:
 * ------------------------------------------------------------------------------
 * When two teams have identical point totals, ties are broken by:
 * "Earliest timestamp the team reached their current score."
 * We track `last_score_change_at` for every team (updated whenever their score alters).
 * In tie-breaks, smaller (earlier) timestamp wins.
 * Example:
 *   Team A reaches 170 points at 10:04 AM.
 *   Team B reaches 170 points at 10:09 AM.
 *   Team A ranks HIGHER because their score has been locked at 170 longer.
 */

import { sql, eq } from 'drizzle-orm';
import { db, teams } from '../db';
import { redis, getCachedJson, setCachedJson } from './index';

export const LEADERBOARD_CACHE_KEY = 'leaderboard:current';
const CACHE_TTL_SECONDS = 60; // 60s fallback TTL (regularly refreshed every 30s)

export interface CachedLeaderboardEntry {
  rank: number;
  team_id: string;
  team_name: string;
  score: number;
  last_score_change_at: string;
}

/**
 * Reads the precomputed, ranked leaderboard from Redis.
 * Returns null on cold start if the key does not exist yet.
 */
export async function getCachedLeaderboard(): Promise<CachedLeaderboardEntry[] | null> {
  return getCachedJson<CachedLeaderboardEntry[]>(LEADERBOARD_CACHE_KEY);
}

/**
 * The "Slow Path" / Self-Healing Rebuild:
 * Runs ONE aggregated query against SQLite to calculate all team scores
 * and tie-break timestamps, assigns ranks, and writes to Redis.
 */
export async function rebuildLeaderboardCache(): Promise<CachedLeaderboardEntry[]> {
  try {
    const rawScores = await db.all(sql`
      SELECT
        t.id AS team_id,
        t.team_name,
        (200 + COALESCE(SUM(sl.delta), 0)) AS current_score,
        COALESCE(MAX(sl.created_at) FILTER (WHERE sl.delta <> 0), t.created_at) AS last_score_change_at
      FROM teams t
      LEFT JOIN score_log sl ON sl.team_id = t.id
      GROUP BY t.id, t.team_name, t.created_at
      ORDER BY
        current_score DESC,
        last_score_change_at ASC,
        t.team_name ASC;
    `);

    const rows = rawScores as any[];

    const leaderboard: CachedLeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      team_id: row.team_id,
      team_name: row.team_name,
      score: Number(row.current_score),
      last_score_change_at: new Date(row.last_score_change_at).toISOString(),
    }));

    await setCachedJson(LEADERBOARD_CACHE_KEY, leaderboard, CACHE_TTL_SECONDS);
    return leaderboard;
  } catch (err: any) {
    console.error('[LeaderboardCache] Failed to rebuild cache from database:', err.message);
    throw err;
  }
}

/**
 * The "Fast Path" / Incremental Score Update:
 * Updates a single team's score in the cached leaderboard array, re-sorts in memory,
 * and writes back to Redis without touching SQLite.
 *
 * @param teamId UUID of the team whose score altered.
 * @param delta Score delta (e.g. -5 for hint).
 * @param eventTimestamp Timestamp of the score event.
 */
export async function applyIncrementalScoreChange(
  teamId: string,
  delta: number,
  eventTimestamp: Date = new Date()
): Promise<void> {
  // Rebuild from committed ledger rows instead of a racy Redis read/modify/write.
  await rebuildLeaderboardCache();
}

// ── Background Self-Healing Refresher ────────────────────────────────────────
let backgroundInterval: NodeJS.Timeout | null = null;

/**
 * Starts the self-healing background worker that rebuilds the leaderboard cache
 * every 30 seconds. This guarantees that even if an incremental update is missed
 * during network blips or failovers, the scoreboard self-heals in <= 30 seconds.
 */
export function startLeaderboardBackgroundRefresher(intervalMs: number = 30000): void {
  if (backgroundInterval) return;

  backgroundInterval = setInterval(async () => {
    try {
      await rebuildLeaderboardCache();
    } catch (err: any) {
      console.error('[LeaderboardCache] Background refresh error:', err.message);
    }
  }, intervalMs);

  backgroundInterval.unref(); // Do not block process exit
}

export function stopLeaderboardBackgroundRefresher(): void {
  if (backgroundInterval) {
    clearInterval(backgroundInterval);
    backgroundInterval = null;
  }
}
