/**
 * Competition Solve Statistics & First-Blood API (/api/stats/* and /stats/*)
 *
 * HARDENING SPECIFICATION — SECTION 8: FIRST-BLOOD & SOLVE-STATS TRACKING
 *
 * Implements:
 * 1. GET /api/stats/solves:
 *    Returns { challenge_id, solve_count, first_blood: { team_name, solved_at } | null }
 *    for all 13 challenges.
 * 2. Caching:
 *    Cached in Redis ('stats:solves') with a 30-second TTL.
 * 3. O(1) Incremental Updates:
 *    On each valid flag submission, atomic Redis operations update the first-blood
 *    and solve count instantly without requiring a full DB table scan.
 */

import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getCachedJson, setCachedJson, redis } from '../cache';

export const statsRouter = Router();

const SOLVES_STATS_CACHE_KEY = 'stats:solves';
const SOLVES_STATS_CACHE_TTL = 30; // 30 seconds

export interface ChallengeSolveStat {
  challenge_id: number;
  solve_count: number;
  first_blood: {
    team_name: string;
    solved_at: string;
  } | null;
}

/**
 * Rebuilds solve statistics directly from SQLite ground-truth.
 */
export async function rebuildSolvesStats(): Promise<ChallengeSolveStat[]> {
  const query = sql`
    SELECT
      c.id AS challenge_id,
      COUNT(s.id) AS solve_count,
      (
        SELECT json_object('team_name', t.team_name, 'solved_at', s1.solved_at)
        FROM solves s1
        JOIN teams t ON t.id = s1.team_id
        WHERE s1.challenge_id = c.id
        ORDER BY s1.solved_at ASC
        LIMIT 1
      ) AS first_blood
    FROM challenges c
    LEFT JOIN solves s ON s.challenge_id = c.id
    GROUP BY c.id
    ORDER BY c.id ASC;
  `;

  const res = await db.all(query);
  const rows = res as any[];

  const stats: ChallengeSolveStat[] = rows.map((r) => {
    let fb = null;
    if (r.first_blood) {
      const firstBlood = JSON.parse(r.first_blood);
      fb = {
        team_name: firstBlood.team_name,
        solved_at: new Date(firstBlood.solved_at).toISOString(),
      };
    }
    return {
      challenge_id: Number(r.challenge_id),
      solve_count: Number(r.solve_count || 0),
      first_blood: fb,
    };
  });

  await setCachedJson(SOLVES_STATS_CACHE_KEY, stats, SOLVES_STATS_CACHE_TTL);
  return stats;
}

/**
 * Retrieves solve statistics from Redis fast-path, falling back to SQLite.
 */
export async function getSolvesStats(): Promise<ChallengeSolveStat[]> {
  const cached = await getCachedJson<ChallengeSolveStat[]>(SOLVES_STATS_CACHE_KEY);
  if (cached) {
    return cached;
  }
  return rebuildSolvesStats();
}

/**
 * Incremental O(1) updater called on valid flag submission.
 */
export async function recordSolveStatIncremental(challengeId: number, teamName: string, solvedAtIso: string): Promise<void> {
  try {
    // 1. Atomic first-blood claim using SETNX
    const fbPayload = JSON.stringify({ team_name: teamName, solved_at: solvedAtIso });
    const claimedFirstBlood = await redis.set(`challenge:first_blood:${challengeId}`, fbPayload, 'NX');

    // 2. Increment solve count
    await redis.incr(`challenge:solve_count:${challengeId}`);

    // 3. Update cached stats array in Redis if already present
    const cached = await getCachedJson<ChallengeSolveStat[]>(SOLVES_STATS_CACHE_KEY);
    if (cached) {
      const entry = cached.find((c) => c.challenge_id === challengeId);
      if (entry) {
        entry.solve_count += 1;
        if (!entry.first_blood) {
          entry.first_blood = { team_name: teamName, solved_at: solvedAtIso };
        }
        await setCachedJson(SOLVES_STATS_CACHE_KEY, cached, SOLVES_STATS_CACHE_TTL);
      }
    } else {
      // Rebuild in background
      rebuildSolvesStats().catch(() => {});
    }
  } catch (err: any) {
    console.warn('[Stats] Incremental solve stat update error:', err.message);
  }
}

/**
 * GET /api/stats/solves (or /stats/solves)
 */
statsRouter.get('/solves', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15, stale-while-revalidate=15');

  try {
    const stats = await getSolvesStats();
    return res.status(200).json(stats);
  } catch (err: any) {
    console.error('[Stats] Error retrieving solve stats:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve solve statistics.',
    });
  }
});
