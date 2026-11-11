/**
 * Public Leaderboard Endpoint (/api/leaderboard and /leaderboard)
 *
 * PUBLIC ENDPOINT (No authentication required).
 * Provides the live ranking of all registered teams.
 *
 * CRITICAL ARCHITECTURAL DECISION: CLOUDFLARE EDGE CACHING
 * ==============================================================================
 * This endpoint sets:
 *   Cache-Control: public, max-age=5, s-maxage=5, stale-while-revalidate=10
 *
 * Why this is the single most important performance decision in the system:
 * - With 40,000 participants and spectators watching the scoreboard, tens of
 *   thousands of HTTP requests hit `/api/leaderboard` every minute.
 * - Cloudflare's edge cache (300+ global locations) stores this response for 5 seconds.
 * - 99%+ of all requests are served directly from Cloudflare's edge CDN for FREE,
 *   with sub-10ms response times globally.
 * - At most ONE request every 5 seconds per Cloudflare edge node reaches origin compute,
 *   which itself reads from Redis in <1ms without touching SQLite.
 * ==============================================================================
 *
 * PUBLIC PRIVACY CONTRACT:
 * Only { rank, team_name, score, last_score_change_at } are emitted.
 * `member_emails`, passwords, IDs, and internal account details are strictly omitted.
 */

import { Router, Request, Response } from 'express';
import { getCachedLeaderboard, rebuildLeaderboardCache } from '../cache/leaderboard';
import { redis, getCachedJson, setCachedJson } from '../cache';

export const leaderboardRouter = Router();

/**
 * GET /api/leaderboard/status (or /leaderboard/status)
 * Returns whether the scoreboard is currently frozen.
 */
leaderboardRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const isFrozen = (await redis.get('platform:leaderboard_frozen')) === 'true';
    const frozenAt = await redis.get('platform:leaderboard_frozen_at');
    return res.status(200).json({
      frozen: isFrozen,
      frozen_at: isFrozen ? frozenAt : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * GET /api/leaderboard (or /leaderboard)
 *
 * Returns the ranked array of teams sorted by score DESC and last_score_change_at ASC.
 */
leaderboardRouter.get('/', async (req: Request, res: Response) => {
  // Edge CDN caching header for Cloudflare / browser caches
  res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=10');

  try {
    // 0. Check if scoreboard is frozen
    const isFrozen = (await redis.get('platform:leaderboard_frozen')) === 'true';
    if (isFrozen) {
      res.setHeader('X-Scoreboard-Frozen', 'true');
      const frozenSnapshot = await getCachedJson<any[]>('leaderboard:frozen');
      if (frozenSnapshot) {
        return res.status(200).json(frozenSnapshot);
      }
    }

    // 1. Read precomputed array from Redis (fast path)
    let cached = await getCachedLeaderboard();

    // 2. Cold Start Graceful Fallback:
    // If the cache has never been built yet (e.g. after a deploy or Redis flush),
    // build it synchronously once from SQLite and serve the result.
    if (!cached) {
      cached = await rebuildLeaderboardCache();
    }

    // 3. Format response: Clean public representation
    // Excludes member_emails and internal fields to guarantee zero data leaks
    const publicLeaderboard = cached.map((entry) => ({
      rank: entry.rank,
      team_name: entry.team_name,
      score: entry.score,
      last_score_change_at: entry.last_score_change_at,
    }));

    if (isFrozen) {
      // Persist snapshot to stable frozen cache
      await setCachedJson('leaderboard:frozen', publicLeaderboard, 86400 * 7);
    }

    return res.status(200).json(publicLeaderboard);
  } catch (err: any) {
    console.error('[Leaderboard] Error serving leaderboard:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve scoreboard.',
    });
  }
});
