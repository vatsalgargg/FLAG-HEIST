/**
 * Participant Dashboard Endpoint (/api/dashboard and /dashboard)
 *
 * Provides the personalized competition interface for the authenticated team.
 *
 * ARCHITECTURAL DESIGN: PERSONALIZED YET CACHE-FRIENDLY
 * "The 'which challenges exist' part is shared/static across all 15,000 teams and
 * should be computed once, not per-request; only the 'did THIS team solve it' part
 * is genuinely per-team and comes from a cheap indexed lookup."
 *
 * - Static Challenges: Cached in memory via `getActiveChallenges()` (5-minute TTL).
 * - Indexed Per-Team Lookups: Solves and revealed hints use indexed B-tree lookups (`team_id`).
 * - Current Score: Sourced directly from the in-memory cached leaderboard in Redis,
 *   falling back to `getTeamScore(teamId)` if the team just registered.
 * - Per-Team Snapshot Cache: Redis key `dashboard:team:<team_id>` absorbs rapid refresh spam (5s TTL).
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asc } from 'drizzle-orm';
import { db, hints } from '../db';
import { config } from '../config';
import { getCachedJson, setCachedJson } from '../cache';
import { getCachedLeaderboard } from '../cache/leaderboard';
import {
  getTeamScore,
  getTeamSolvedChallengeIds,
  getTeamRevealedHintIds,
  getAllChallenges,
} from '../scoring/calculate';
import { requireTeamAuth } from '../middleware/auth';

export const dashboardRouter = Router();

const DASHBOARD_CACHE_TTL_SECONDS = 5;

// In-memory cache for hint structures (hints do not change during event)
let cachedAllHints: any[] | null = null;
let hintsCacheExpiresAt = 0;

async function getAllHints() {
  const now = Date.now();
  if (cachedAllHints && now < hintsCacheExpiresAt) {
    return cachedAllHints;
  }
  const rows = await db
    .select({
      id: hints.id,
      challengeId: hints.challengeId,
      cost: hints.cost,
      content: hints.content,
      displayOrder: hints.displayOrder,
    })
    .from(hints)
    .orderBy(asc(hints.displayOrder));

  cachedAllHints = rows;
  hintsCacheExpiresAt = now + 5 * 60 * 1000; // 5 min TTL
  return rows;
}

/**
 * GET /api/dashboard (or /dashboard)
 *
 * Protected endpoint returning the active team's score, challenge status, and hints.
 */
dashboardRouter.get('/', requireTeamAuth, async (req: Request, res: Response) => {
  const teamId = req.team!.id;
  const teamName = req.team!.teamName;
  const cacheKey = `dashboard:team:${teamId}`;
  const bypassCache = req.query.fresh === 'true';

  // 1. Check Redis per-team snapshot cache
  if (!bypassCache) {
    const cachedData = await getCachedJson(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedData);
    }
  }

  try {
    // 2. Resolve team's current score from cached leaderboard, falling back to getTeamScore()
    const currentScore = await getTeamScore(teamId);

    // 3. Parallel fetch: static challenges, hints metadata, and team's indexed solves/hints
    const [challengesList, allHints, solvedIds, revealedHintIds] = await Promise.all([
      getAllChallenges(),
      getAllHints(),
      getTeamSolvedChallengeIds(teamId),
      getTeamRevealedHintIds(teamId),
    ]);

    // Map hints by challenge ID (masking unrevealed content!)
    const hintsByChallenge = new Map<number, any[]>();
    for (const h of allHints) {
      const isRevealed = revealedHintIds.has(h.id);
      if (!hintsByChallenge.has(h.challengeId)) {
        hintsByChallenge.set(h.challengeId, []);
      }
      hintsByChallenge.get(h.challengeId)!.push({
        id: h.id,
        cost: h.cost,
        displayOrder: h.displayOrder,
        revealed: isRevealed,
        // SECURITY: Mask hint content until team reveals it
        content: isRevealed ? h.content : null,
      });
    }

    // Generate deterministic team collaborator token based on teamId
    const teamCollabToken = `clb_${crypto.createHmac('sha256', config.jwtSecret || 'dev-secret').update(teamId).digest('hex').slice(0, 16)}`;
    const collabBaseUrl = process.env.COLLAB_PUBLIC_URL || process.env.COLLAB_URL || 'http://localhost:8082';
    const collabCallbackUrl = `${(process.env.COLLAB_CALLBACK_URL || collabBaseUrl).replace(/\/+$/, '')}/c/${teamCollabToken}`;
    const collabLogUrl = `${collabBaseUrl.replace(/\/+$/, '')}/collab/${teamCollabToken}/log`;

    // Build challenge cards with solve status and active/down badge
    const challengeMatrix = challengesList.map((ch) => {
      const isSolved = solvedIds.has(ch.id);

      // Participant target links and access credentials
      let targetUrl: string | null = null;
      let accessInfo: string | null = null;
      let collabInfo: { token: string; callbackUrl: string; logUrl: string } | null = null;

      if (ch.id === 1) {
        targetUrl = process.env.CHALLENGE_01_PUBLIC_URL || 'http://localhost:3001';
      } else if (ch.id === 3) {
        targetUrl = process.env.CHALLENGE_03_TWITTER_URL || 'https://twitter.com/ethancole_ops7';
      } else if (ch.id === 4) {
        targetUrl = process.env.CHALLENGE_04_PUBLIC_URL || 'http://localhost:3004';
        accessInfo = 'Internal Staff Staging Gateway';
      } else if (ch.id === 5) {
        targetUrl = process.env.CHALLENGE_05_PUBLIC_URL || 'http://localhost:3005';
        accessInfo = 'Corporate Directory Query System';
      } else if (ch.id === 7) {
        targetUrl = process.env.CHALLENGE_07_PUBLIC_URL || 'http://localhost:3007';
        accessInfo = 'Shared Participant Account: priya.nair / Veyra#Audit26';
      } else if (ch.id === 8) {
        targetUrl = process.env.CHALLENGE_08_PUBLIC_URL || 'http://localhost:3007';
        accessInfo = 'Shared Participant Account: priya.nair / Veyra#Audit26';
      } else if (ch.id === 9) {
        targetUrl = process.env.CHALLENGE_09_PUBLIC_URL || 'http://localhost:3009';
        accessInfo = 'Session Integrity Engine';
      } else if (ch.id === 10) {
        targetUrl = process.env.CHALLENGE_10_PUBLIC_URL || 'http://localhost:3010';
        accessInfo = 'Backup Gateway File Server';
      } else if (ch.id === 12) {
        targetUrl = process.env.CHALLENGE_12_PUBLIC_URL || 'http://localhost:3012';
        accessInfo = `Diagnostic Probe System | Team Callback: ${collabCallbackUrl}`;
        collabInfo = { token: teamCollabToken, callbackUrl: collabCallbackUrl, logUrl: collabLogUrl };
      } else if (ch.id === 13) {
        targetUrl = process.env.CHALLENGE_13_PUBLIC_URL || 'http://localhost:3013';
        accessInfo = `Mesh Link Previewer | Team Callback: ${collabCallbackUrl}`;
        collabInfo = { token: teamCollabToken, callbackUrl: collabCallbackUrl, logUrl: collabLogUrl };
      }

      return {
        id: ch.id,
        name: ch.name,
        tier: ch.tier,
        points: ch.points,
        isActive: ch.isActive,
        // Status and badge indicating open, solved, or temporarily down
        status: !ch.isActive ? 'temporarily_down' : isSolved ? 'solved' : 'unsolved',
        badge: !ch.isActive ? 'Temporarily Down' : isSolved ? 'Solved' : 'Open',
        solved: isSolved,
        targetUrl,
        accessInfo,
        collabInfo,
        hints: hintsByChallenge.get(ch.id) || [],
      };
    });

    const solvedCount = solvedIds.size;
    const totalChallenges = challengesList.length;

    const payload = {
      team: {
        id: teamId,
        teamName,
        score: currentScore,
        solvesCount: solvedCount,
      },
      score: {
        currentScore,
        startingScore: 200,
        pointsLost: Math.max(0, 200 - currentScore),
      },
      progress: {
        totalChallenges,
        solvedCount,
        solvePercentage: totalChallenges > 0 ? Math.round((solvedCount / totalChallenges) * 100) : 0,
      },
      challenges: challengeMatrix,
      cachedAt: new Date().toISOString(),
    };

    // Cache per-team snapshot in Redis
    await setCachedJson(cacheKey, payload, DASHBOARD_CACHE_TTL_SECONDS);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('[Dashboard] Error building dashboard:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve competition dashboard.',
    });
  }
});
