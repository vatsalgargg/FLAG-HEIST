/**
 * Flag Submission Routes (/api/submit and /submit)
 *
 * Implements idempotent flag verification and scoring.
 *
 * IDEMPOTENCY & CONCURRENCY DESIGN:
 * ==============================================================================
 * 1. Database-Level Constraint: Relies on `UNIQUE(team_id, challenge_id)` on the
 *    `solves` table.
 * 2. Zero Race Conditions: We attempt the `INSERT` directly. If duplicate requests
 *    arrive simultaneously from multiple browser tabs or automated scripts, SQLite
 *    rejects the secondary insert with error code `SQLITE_CONSTRAINT_UNIQUE` (unique violation).
 * 3. Safe Duplicate Handling: Caught `SQLITE_CONSTRAINT_UNIQUE` errors return `{ status: "already_solved" }`
 *    with HTTP 200 without mutating the audit log, points, or Redis cache.
 * 4. Active Check: Submissions are rejected with HTTP 400 (`ChallengeInactive`)
 *    if the challenge is deactivated by an administrator.
 * 5. Rate Limiting: Backed by the distributed Redis rate limiter (15 requests/min per team)
 *    to prevent automated flag guessing or brute-force attacks across autoscaling instances.
 * ==============================================================================
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, challenges, solves } from '../db';
import { config } from '../config';
import { computeFlagHash } from '../scoring/flags';
import { isChallengeUnlockedForTeam } from '../scoring/calculate';
import { appendScoreEvent } from '../scoring/recordScoreEvent';
import { deleteCacheKey, redis } from '../cache';
import { rebuildLeaderboardCache } from '../cache/leaderboard';
import { requireTeamAuth } from '../middleware/auth';
import { requireNotMaintenanceMode } from '../middleware/maintenance';
import { createRateLimiter, RATE_LIMIT_CONFIG } from '../middleware/rateLimiter';
import { recordSolveStatIncremental } from './stats';

export const submitRouter = Router();

// Distributed Redis rate limiter: 15 submissions per minute per team
const submitLimiter = createRateLimiter(RATE_LIMIT_CONFIG.flagSubmit);

/**
 * POST / (or /api/submit)
 *
 * Accepts: { challenge_id: number, flag: string }
 */
submitRouter.post('/', requireNotMaintenanceMode, requireTeamAuth, submitLimiter, async (req: Request, res: Response) => {
  const teamId = req.team!.id;
  const rawId = req.body.challenge_id ?? req.body.challengeId;
  const flag = req.body.flag;

  // 1. Validate payload
  const challengeId = Number(rawId);
  if (!challengeId || isNaN(challengeId) || !flag || typeof flag !== 'string') {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'challenge_id (number) and flag (string) are required.',
    });
  }

  const cleanFlag = flag.trim();
  if (cleanFlag.length === 0 || cleanFlag.length > 256) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Submitted flag cannot be empty or exceed 256 characters.',
    });
  }

  try {
    // 2. Fetch challenge
    const [challenge] = await db
      .select({
        id: challenges.id,
        name: challenges.name,
        points: challenges.points,
        flagHash: challenges.flagHash,
        isActive: challenges.isActive,
      })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Challenge #${challengeId} does not exist.`,
      });
    }

    // 3. Challenge active check
    if (!challenge.isActive) {
      return res.status(400).json({
        error: 'ChallengeInactive',
        message: `Challenge #${challengeId} ("${challenge.name}") is temporarily deactivated. Flag submissions are paused.`,
      });
    }

    // 3b. Sequential unlock: earlier challenges must be solved first
    if (!(await isChallengeUnlockedForTeam(teamId, challenge.id))) {
      return res.status(403).json({
        error: 'ChallengeLocked',
        message: 'Solve the previous task first to unlock this one.',
      });
    }

    // 4. Cryptographic flag hash verification
    const submittedHash = computeFlagHash(cleanFlag, config.flagPepper);
    if (challenge.flagHash.length !== submittedHash.length || !crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(challenge.flagHash))) {
      return res.status(200).json({
        status: 'incorrect',
        message: 'Incorrect flag. Keep hunting!',
      });
    }

    // 5. Atomic solve insertion (Idempotency pattern)
    try {
      db.transaction(tx => {
        tx.insert(solves).values({ teamId, challengeId: challenge.id }).run();
        appendScoreEvent(teamId, 0, `solve:ch${challenge.id}`, 'system', tx);
      });
    } catch (insertErr: any) {
      // SQLite error SQLITE_CONSTRAINT_UNIQUE = unique_violation on solves(team_id, challenge_id)
      const isUniqueViolation = (insertErr.cause?.code ?? insertErr.code) === 'SQLITE_CONSTRAINT_UNIQUE';

      if (isUniqueViolation) {
        return res.status(200).json({
          status: 'already_solved',
          message: 'Challenge already solved by your team.',
          challenge_id: challenge.id,
        });
      }
      throw insertErr;
    }

    // 6. Record solve event in append-only audit trail


    // 6b. O(1) Incremental First-Blood & Solve Count Tracking (Hardening Section 8)
    recordSolveStatIncremental(challenge.id, req.team!.teamName, new Date().toISOString()).catch((err) => {
      console.warn('[Submit] Failed to record solve stat incremental:', err.message);
    });

    // 7. Cache invalidation
    // Invalidate team's cached dashboard snapshot so next GET /api/dashboard immediately reflects solve
    await deleteCacheKey(`dashboard:team:${teamId}`);

    // Trigger non-blocking leaderboard sync
    rebuildLeaderboardCache().catch((err) => {
      console.warn('[Submit] Background leaderboard sync warning:', err.message);
    });

    return res.status(200).json({
      status: 'correct',
      message: `Flag accepted! "${challenge.name}" solved.`,
      challenge_id: challenge.id,
      points: challenge.points,
    });
  } catch (err: any) {
    console.error(`[Submit] Unexpected error for team ${teamId} on challenge ${challengeId}:`, err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to process flag submission.',
    });
  }
});
