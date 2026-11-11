/**
 * Hints Routes (/api/hints/* and /hints/*)
 *
 * Implements loss-based hint revelations:
 * - When a team reveals a hint, points are deducted immediately via an append-only entry in score_log (delta = -hint.cost).
 * - Idempotency: SQLite UNIQUE(team_id, hint_id) ensures points are deducted only once.
 *   Subsequent reveal calls return the hint content with zero additional point penalty.
 * - Cache Invalidation: Purges dashboard snapshot and updates Redis leaderboard via appendScoreEvent.
 */

import { Router, Request, Response } from 'express';
import { eq, and, asc } from 'drizzle-orm';
import { db, hints, hintsRevealed, challenges } from '../db';
import { requireTeamAuth } from '../middleware/auth';
import { requireNotMaintenanceMode } from '../middleware/maintenance';
import { rebuildLeaderboardCache } from '../cache/leaderboard';
import { deleteCacheKey, redis } from '../cache';
import { appendScoreEvent } from '../scoring/recordScoreEvent';
import { isChallengeUnlockedForTeam } from '../scoring/calculate';

export const hintsRouter = Router();

/**
 * GET /api/hints/:challengeId (or /api/challenges/:challengeId/hints)
 * Returns the hints list for a challenge, masking unrevealed content.
 */
hintsRouter.get(['/:challengeId', '/challenge/:challengeId'], requireTeamAuth, async (req: Request, res: Response) => {
  const teamId = req.team!.id;
  const rawChallengeId = req.params.challengeId;
  const challengeId = parseInt(Array.isArray(rawChallengeId) ? rawChallengeId[0] : rawChallengeId, 10);

  if (isNaN(challengeId)) {
    return res.status(400).json({ error: 'ValidationError', message: 'Invalid challenge ID.' });
  }

  try {
    const [challenge] = await db
      .select({ id: challenges.id, name: challenges.name })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({ error: 'NotFound', message: `Challenge #${challengeId} does not exist.` });
    }

    const challengeHints = await db
      .select({
        id: hints.id,
        challengeId: hints.challengeId,
        cost: hints.cost,
        content: hints.content,
        displayOrder: hints.displayOrder,
      })
      .from(hints)
      .where(eq(hints.challengeId, challengeId))
      .orderBy(asc(hints.displayOrder));

    const revealedRecords = await db
      .select({ hintId: hintsRevealed.hintId })
      .from(hintsRevealed)
      .where(eq(hintsRevealed.teamId, teamId));

    const revealedSet = new Set(revealedRecords.map((r) => r.hintId));

    const sanitizedHints = challengeHints.map((h) => {
      const isRevealed = revealedSet.has(h.id);
      return {
        id: h.id,
        challengeId: h.challengeId,
        cost: h.cost,
        displayOrder: h.displayOrder,
        revealed: isRevealed,
        content: isRevealed ? h.content : null,
      };
    });

    return res.status(200).json({
      challengeId,
      hints: sanitizedHints,
    });
  } catch (err: any) {
    console.error('[Hints] Error fetching hints:', err.message);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve hints.' });
  }
});

/**
 * Helper to lookup hint by UUID or challengeId
 */
async function findHint(hintIdentifier: string) {
  // If it matches UUID format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hintIdentifier);
  if (isUuid) {
    const [hint] = await db
      .select({
        id: hints.id,
        challengeId: hints.challengeId,
        cost: hints.cost,
        content: hints.content,
      })
      .from(hints)
      .where(eq(hints.id, hintIdentifier))
      .limit(1);
    return hint || null;
  }

  // Otherwise check if it's an integer challengeId
  const chId = parseInt(hintIdentifier, 10);
  if (!isNaN(chId)) {
    const [hint] = await db
      .select({
        id: hints.id,
        challengeId: hints.challengeId,
        cost: hints.cost,
        content: hints.content,
      })
      .from(hints)
      .where(eq(hints.challengeId, chId))
      .limit(1);
    return hint || null;
  }

  return null;
}

/**
 * POST /api/hints/:hintId/reveal (or /hints/:hintId/reveal)
 * Explicitly reveals a hint, deducting points from the team's score.
 */
hintsRouter.post(['/:hintId/reveal', '/reveal/:hintId'], requireNotMaintenanceMode, requireTeamAuth, async (req: Request, res: Response) => {
  const teamId = req.team!.id;
  const rawHintId = req.params.hintId || req.body.hintId;
  const hintParam = Array.isArray(rawHintId) ? rawHintId[0] : String(rawHintId || '');

  if (!hintParam) {
    return res.status(400).json({ error: 'ValidationError', message: 'Hint ID is required.' });
  }

  try {
    // 1. Fetch hint record
    const hint = await findHint(hintParam);

    if (!hint) {
      return res.status(404).json({ error: 'NotFound', message: `Hint "${hintParam}" does not exist.` });
    }

    const [challenge] = await db.select({ active: challenges.isActive }).from(challenges).where(eq(challenges.id, hint.challengeId)).limit(1);
    if (!challenge?.active) return res.status(400).json({ message: 'This challenge is temporarily unavailable.' });
    if (!(await isChallengeUnlockedForTeam(teamId, hint.challengeId))) {
      return res.status(403).json({ error: 'ChallengeLocked', message: 'Solve the previous task first to unlock its hints.' });
    }

    // 2. Idempotent-insert pattern: attempt insert into hints_revealed first
    try {
      db.transaction(tx => {
        tx.insert(hintsRevealed).values({ teamId, hintId: hint.id }).run();
        appendScoreEvent(teamId, -Math.abs(hint.cost), `hint_reveal:${hint.id}`, 'system', tx);
      });
      // Publish only committed scores; the database is authoritative.
      await rebuildLeaderboardCache().catch(() => {});

      // Invalidate team dashboard snapshot cache
      await deleteCacheKey(`dashboard:team:${teamId}`);

      return res.status(200).json({
        success: true,
        already_revealed: false,
        message: `Hint revealed! Permanent deduction of ${hint.cost} points applied.`,
        points_deducted: hint.cost,
        hint: {
          id: hint.id,
          challengeId: hint.challengeId,
          cost: hint.cost,
          content: hint.content,
          revealed: true,
        },
      });
    } catch (insertErr: any) {
      // 4. Catch unique-constraint violation (already revealed)
      const isUniqueViolation = (insertErr.cause?.code ?? insertErr.code) === 'SQLITE_CONSTRAINT_UNIQUE';

      if (isUniqueViolation) {
        return res.status(200).json({
          success: true,
          already_revealed: true,
          message: 'Hint has already been revealed for your team.',
          hint: {
            id: hint.id,
            challengeId: hint.challengeId,
            cost: hint.cost,
            content: hint.content,
            revealed: true,
          },
        });
      }

      throw insertErr;
    }
  } catch (err: any) {
    console.error(`[Hints] Error revealing hint "${hintParam}":`, err.message);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to reveal hint.' });
  }
});
