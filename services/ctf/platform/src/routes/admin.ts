/**
 * Administrator Routes (/api/admin/* and /admin/*)
 *
 * Implements administrative operations for ROOT CTF:
 * 1. Administrator authentication & session inspection (protected by ADMIN_JWT_SECRET).
 * 2. Distributed rate limiting on admin login via Redis.
 * 3. Paginated & searchable team directory with computed scores and solve counts.
 * 4. Audit-logged manual score adjustments requiring mandatory reason justification.
 * 5. Full chronological score dispute history per team.
 * 6. Challenge status toggling (instant enable/disable pausing flag submissions).
 * 7. Standardized challenge force-reset proxy dispatching to challenge backend services.
 * 8. Minimal functional admin dashboard UI.
 */

import { Router, Request, Response } from 'express';
import { eq, sql, asc, desc } from 'drizzle-orm';
import { db, adminUsers, teams, scoreLog, solves, challenges, announcements } from '../db';
import { config } from '../config';
import { hashPassword, verifyPassword } from '../auth/password';
import { issueAdminToken } from '../auth/tokens';
import { setAdminCookie, clearAdminCookie } from '../auth/cookies';
import { requireAdminAuth } from '../middleware/auth';
import { createRateLimiter, RATE_LIMIT_CONFIG } from '../middleware/rateLimiter';
import { getTeamScore, invalidateChallengeCache } from '../scoring/calculate';
import { recordScoreEvent, appendScoreEvent } from '../scoring/recordScoreEvent';
import { redis, getCachedJson, setCachedJson, deleteCacheKey } from '../cache';
import { getCachedLeaderboard, rebuildLeaderboardCache } from '../cache/leaderboard';
import { getChallengeBaseUrl, CHALLENGE_SERVICES } from '../config/challengeUrls';

export const adminRouter = Router();

// Tightly throttled Redis-backed rate limiter for admin login (max 10 requests/min per IP)
const adminLoginLimiter = createRateLimiter(RATE_LIMIT_CONFIG.adminLogin);

/**
 * POST /login (or /api/admin/login)
 *
 * Authenticates an administrator against the admin_users table and sets the veyra_admin_session cookie.
 */
adminRouter.post('/login', adminLoginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Username and password are required.',
    });
  }

  const cleanUsername = username.trim();

  try {
    const [admin] = await db
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        role: adminUsers.role,
        passwordHash: adminUsers.passwordHash,
      })
      .from(adminUsers)
      .where(eq(adminUsers.username, cleanUsername))
      .limit(1);

    // Constant error response blocks username enumeration
    if (!admin) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    const isValidPassword = await verifyPassword(password, admin.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    // Issue isolated admin token and set admin cookie
    const token = issueAdminToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });
    setAdminCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Administrator login successful.',
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (err: any) {
    console.error('[Admin-Login] Unexpected error:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Admin login processing failed.',
    });
  }
});

/**
 * GET /me (or /api/admin/me)
 *
 * Returns current authenticated administrator session info.
 */
adminRouter.get('/me', requireAdminAuth, (req: Request, res: Response) => {
  return res.status(200).json({
    authenticated: true,
    admin: req.admin,
  });
});

/**
 * POST /logout (or /api/admin/logout)
 *
 * Clears administrator session cookie.
 */
adminRouter.post('/logout', (req: Request, res: Response) => {
  clearAdminCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Admin logged out successfully.',
  });
});

/**
 * GET /teams (or /api/admin/teams)
 *
 * Returns paginated, searchable list of teams with their derived score,
 * solve count, and registration time.
 *
 * WHY PAGINATION IS CRITICAL:
 * With up to 15,000 teams and 40,000 participants, returning all teams in a single
 * unpaged payload is wasteful, slow, and can exhaust node/browser heap memory.
 * The admin interface pages through results (default 100/page) while SQLite
 * executes an indexed LIMIT/OFFSET query.
 */
adminRouter.get('/teams', requireAdminAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 100));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const offset = (page - 1) * limit;

  try {
    const searchPattern = search ? `%${search}%` : null;

    // Count total matching teams for pagination controls
    const countQuery = searchPattern
      ? sql`SELECT COUNT(*) AS total FROM teams WHERE team_name LIKE ${searchPattern}`
      : sql`SELECT COUNT(*) AS total FROM teams`;

    const countRes = await db.all(countQuery);
    const totalTeams = Number((countRes[0] as any)?.total || 0);
    const totalPages = Math.ceil(totalTeams / limit) || 1;

    // Retrieve page of teams with derived score and solve count
    const teamsQuery = searchPattern
      ? sql`
          SELECT
            t.id,
            t.team_name,
            t.team_size,
            t.member_emails,
            t.created_at,
            (200 + COALESCE((SELECT SUM(ledger.delta) FROM score_log ledger WHERE ledger.team_id = t.id), 0)) AS current_score,
            COUNT(DISTINCT s.challenge_id) AS solved_count
          FROM teams t
          LEFT JOIN score_log sl ON sl.team_id = t.id
          LEFT JOIN solves s ON s.team_id = t.id
          WHERE t.team_name LIKE ${searchPattern}
          GROUP BY t.id, t.team_name, t.team_size, t.member_emails, t.created_at
          ORDER BY current_score DESC, t.created_at ASC
          LIMIT ${limit} OFFSET ${offset};
        `
      : sql`
          SELECT
            t.id,
            t.team_name,
            t.team_size,
            t.member_emails,
            t.created_at,
            (200 + COALESCE((SELECT SUM(ledger.delta) FROM score_log ledger WHERE ledger.team_id = t.id), 0)) AS current_score,
            COUNT(DISTINCT s.challenge_id) AS solved_count
          FROM teams t
          LEFT JOIN score_log sl ON sl.team_id = t.id
          LEFT JOIN solves s ON s.team_id = t.id
          GROUP BY t.id, t.team_name, t.team_size, t.member_emails, t.created_at
          ORDER BY current_score DESC, t.created_at ASC
          LIMIT ${limit} OFFSET ${offset};
        `;

    const teamsRes = await db.all(teamsQuery);
    const rows = teamsRes as any[];

    const formattedTeams = rows.map((r) => ({
      id: r.id,
      team_name: r.team_name,
      team_size: Number(r.team_size),
      member_emails: JSON.parse(r.member_emails),
      created_at: new Date(r.created_at).toISOString(),
      score: Number(r.current_score),
      solved_count: Number(r.solved_count),
    }));

    return res.status(200).json({
      success: true,
      teams: formattedTeams,
      pagination: {
        page,
        limit,
        total_teams: totalTeams,
        total_pages: totalPages,
      },
    });
  } catch (err: any) {
    console.error('[Admin-Teams] Query error:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve team directory.',
    });
  }
});

/**
 * POST /teams/:teamId/adjust-score (or /api/admin/teams/:teamId/adjust-score)
 *
 * Manually adjusts a team's score.
 *
 * MANDATORY AUDIT TRAIL CONTRACT:
 * "reason is REQUIRED, not optional — reject the request with a clear error if it's
 * missing or blank. Every manual adjustment becomes a permanent row in score_log
 * with this reason attached and the admin's username as actor; an adjustment with
 * no reason defeats the entire purpose of the audit trail this system was designed
 * around back in Prompt 2."
 */
adminRouter.post('/teams/:teamId/adjust-score', requireAdminAuth, async (req: Request, res: Response) => {
  const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
  const { delta, reason } = req.body;

  // 1. Mandatory Reason Validation
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'A non-empty "reason" is strictly required for manual score adjustments to preserve the audit trail.',
    });
  }

  // 2. Delta Validation
  const numericDelta = Number(delta);
  if (!Number.isSafeInteger(numericDelta) || numericDelta === 0 || Math.abs(numericDelta) > 1000000) {
    return res.status(400).json({
      error: 'ValidationError',
      message: '"delta" must be a non-zero integer representing the point adjustment.',
    });
  }

  try {
    // 3. Verify Team Exists
    const [team] = await db
      .select({ id: teams.id, teamName: teams.teamName })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Team with ID "${teamId}" does not exist.`,
      });
    }

    // 4. Centralized Score Event Insertion
    // Calls recordScoreEvent so the append-only ledger and Redis fast-path update identically
    const adminUsername = req.admin!.username;
    await recordScoreEvent(team.id, numericDelta, reason.trim(), adminUsername);

    // 5. Invalidate team's cached dashboard snapshot
    await deleteCacheKey(`dashboard:team:${team.id}`);

    // 6. Query updated score and full chronological history for verification
    const [newScore, historyRows] = await Promise.all([
      getTeamScore(team.id),
      db
        .select({
          id: scoreLog.id,
          teamId: scoreLog.teamId,
          delta: scoreLog.delta,
          reason: scoreLog.reason,
          actor: scoreLog.actor,
          createdAt: scoreLog.createdAt,
        })
        .from(scoreLog)
        .where(eq(scoreLog.teamId, team.id))
        .orderBy(asc(scoreLog.createdAt)),
    ]);

    return res.status(200).json({
      success: true,
      message: `Score adjusted by ${numericDelta > 0 ? '+' : ''}${numericDelta} points for team "${team.teamName}".`,
      team_id: team.id,
      team_name: team.teamName,
      new_score: newScore,
      history: historyRows.map((h) => ({
        id: h.id,
        team_id: h.teamId,
        delta: h.delta,
        reason: h.reason,
        actor: h.actor,
        created_at: h.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error(`[Admin-ScoreAdjust] Error for team ${teamId}:`, err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to adjust team score.',
    });
  }
});

/**
 * GET /teams/:teamId/history (or /api/admin/teams/:teamId/history)
 *
 * Returns every score_log row for a team in chronological order.
 *
 * "This is the direct answer to 'a team is disputing their score — what actually happened',
 * and it should need zero manual database queries, ever, during the live event."
 */
adminRouter.get('/teams/:teamId/history', requireAdminAuth, async (req: Request, res: Response) => {
  const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;

  try {
    const [team] = await db
      .select({ id: teams.id, teamName: teams.teamName })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Team with ID "${teamId}" does not exist.`,
      });
    }

    const historyRows = await db
      .select({
        id: scoreLog.id,
        teamId: scoreLog.teamId,
        delta: scoreLog.delta,
        reason: scoreLog.reason,
        actor: scoreLog.actor,
        createdAt: scoreLog.createdAt,
      })
      .from(scoreLog)
      .where(eq(scoreLog.teamId, team.id))
      .orderBy(asc(scoreLog.createdAt));

    const currentScore = await getTeamScore(team.id);

    return res.status(200).json({
      success: true,
      team_id: team.id,
      team_name: team.teamName,
      current_score: currentScore,
      history: historyRows.map((h) => ({
        id: h.id,
        team_id: h.teamId,
        delta: h.delta,
        reason: h.reason,
        actor: h.actor,
        created_at: h.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error(`[Admin-History] Error for team ${teamId}:`, err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve team score history.',
    });
  }
});

/**
 * GET /challenges (or /api/admin/challenges)
 *
 * Returns all 13 challenges and their operational configuration.
 */
adminRouter.get('/challenges', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
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

    const challengeStatusList = rows.map((ch) => {
      const serviceConfig = CHALLENGE_SERVICES[ch.id];
      const serviceUrl = getChallengeBaseUrl(ch.id);
      return {
        id: ch.id,
        name: ch.name,
        tier: ch.tier,
        points: ch.points,
        is_active: ch.isActive,
        is_dynamic: serviceConfig?.isDynamic ?? false,
        service_url: serviceUrl,
      };
    });

    return res.status(200).json({
      success: true,
      challenges: challengeStatusList,
    });
  } catch (err: any) {
    console.error('[Admin-Challenges] Error:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve challenge operational status.',
    });
  }
});

/**
 * POST /challenges/:challengeId/toggle-active (or /api/admin/challenges/:challengeId/toggle-active)
 *
 * Flips `is_active` on the challenges table.
 * Immediately pauses flag submissions for that challenge via /api/submit.
 */
adminRouter.post('/challenges/:challengeId/toggle-active', requireAdminAuth, async (req: Request, res: Response) => {
  const rawChallengeId = Array.isArray(req.params.challengeId) ? req.params.challengeId[0] : req.params.challengeId;
  const challengeId = parseInt(rawChallengeId, 10);
  if (isNaN(challengeId)) {
    return res.status(400).json({ error: 'ValidationError', message: 'Invalid challenge ID.' });
  }

  try {
    const [ch] = await db
      .select({ id: challenges.id, name: challenges.name, isActive: challenges.isActive })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!ch) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Challenge #${challengeId} does not exist.`,
      });
    }

    const nextState = !ch.isActive;

    const [updated] = await db
      .update(challenges)
      .set({ isActive: nextState })
      .where(eq(challenges.id, challengeId))
      .returning({
        id: challenges.id,
        name: challenges.name,
        isActive: challenges.isActive,
      });

    // Invalidate in-memory challenge cache
    invalidateChallengeCache();

    return res.status(200).json({
      success: true,
      message: `Challenge #${updated.id} ("${updated.name}") is now ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}.`,
      challenge_id: updated.id,
      name: updated.name,
      is_active: updated.isActive,
    });
  } catch (err: any) {
    console.error(`[Admin-ToggleActive] Error on challenge ${challengeId}:`, err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to toggle challenge active state.',
    });
  }
});

/**
 * POST /challenges/:challengeId/force-reset (or /api/admin/challenges/:challengeId/force-reset)
 *
 * STANDARD RESET CONTRACT DISPATCHER:
 * ==============================================================================
 * Dispatches a force-reset command to the target challenge microservice:
 *   POST {challenge_service_base_url}/reset/{challenge_id}
 *   Headers: Authorization: Bearer {RESET_TOKEN}
 *
 * WHY THIS INDIRECTION MATTERS:
 * "The admin panel never needs to know HOW a given challenge resets itself internally
 * (clearing a sandboxed container, wiping a database table, regenerating a file) —
 * it only needs every challenge to expose this one identical contract, which is what
 * makes 'same call shape for every container' actually achievable across 13 very
 * different services built by different prompts."
 * ==============================================================================
 */
adminRouter.post('/challenges/:challengeId/force-reset', requireAdminAuth, async (req: Request, res: Response) => {
  const rawChallengeId = Array.isArray(req.params.challengeId) ? req.params.challengeId[0] : req.params.challengeId;
  const challengeId = parseInt(rawChallengeId, 10);
  if (isNaN(challengeId)) {
    return res.status(400).json({ error: 'ValidationError', message: 'Invalid challenge ID.' });
  }

  try {
    const [ch] = await db
      .select({ id: challenges.id, name: challenges.name })
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!ch) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Challenge #${challengeId} does not exist.`,
      });
    }

    const serviceConfig = CHALLENGE_SERVICES[challengeId];
    const baseUrl = getChallengeBaseUrl(challengeId);

    // Static challenges have no dynamic reset service
    if (!serviceConfig?.isDynamic && !baseUrl) {
      return res.status(200).json({
        success: true,
        challenge_id: challengeId,
        message: `Challenge #${challengeId} ("${ch.name}") is a static challenge with no backend container service to reset.`,
        reset_at: new Date().toISOString(),
        upstream_status: 200,
        upstream_response: { status: 'ok', type: 'static_noop' },
      });
    }

    if (!baseUrl) {
      return res.status(503).json({
        success: false,
        error: 'ServiceUnavailable',
        message: `No service base URL is configured for challenge #${challengeId}. Set ${serviceConfig?.envVar || 'CHALLENGE_URL'} in environment.`,
      });
    }

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/reset/${challengeId}`;
    const bearerToken = config.resetToken || '';

    // Invoke challenge reset hook with 5-second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let upstreamResponse: globalThis.Response;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Veyra-Platform-Admin/1.0',
        },
        body: JSON.stringify({
          challenge_id: challengeId,
          requested_by: req.admin!.username,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const isAbort = fetchErr.name === 'AbortError';
      return res.status(502).json({
        success: false,
        challenge_id: challengeId,
        error: 'ResetProxyError',
        message: isAbort
          ? `Reset request to challenge #${challengeId} service timed out after 5000ms.`
          : `Failed to connect to challenge #${challengeId} service at ${targetUrl}: ${fetchErr.message}`,
      });
    } finally {
      clearTimeout(timeout);
    }

    let responseData: any;
    const rawText = await upstreamResponse.text();
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { raw: rawText };
    }

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        success: false,
        challenge_id: challengeId,
        error: 'UpstreamResetFailure',
        message: `Challenge service returned HTTP ${upstreamResponse.status}`,
        upstream_status: upstreamResponse.status,
        upstream_response: responseData,
      });
    }

    return res.status(200).json({
      success: true,
      challenge_id: challengeId,
      message: `Challenge #${challengeId} reset successfully executed.`,
      reset_at: new Date().toISOString(),
      upstream_status: upstreamResponse.status,
      upstream_response: responseData,
    });
  } catch (err: any) {
    console.error(`[Admin-ForceReset] Error on challenge ${challengeId}:`, err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to dispatch challenge force-reset.',
    });
  }
});

/**
 * ==============================================================================
 * GET /export/results (or /api/admin/export/results)
 *
 * AUTHORITATIVE EVENT RECORD EXPORT (Phase N Requirement)
 * Generates an immutable, ground-truth snapshot directly from SQLite:
 * - Every team's derived final score (200 + SUM(score_log.delta))
 * - Full chronological solve timeline per team
 * - Full append-only score_log audit history per team
 * - Supports format=json (default) and format=csv
 * ==============================================================================
 */
adminRouter.get('/export/results', requireAdminAuth, async (req: Request, res: Response) => {
  const format = String(req.query.format || 'json').toLowerCase();

  try {
    // 1. Fetch all teams
    const allTeams = await db
      .select({
        id: teams.id,
        teamName: teams.teamName,
        teamSize: teams.teamSize,
        memberEmails: teams.memberEmails,
        createdAt: teams.createdAt,
      })
      .from(teams);

    // 2. Fetch all solves with challenge names
    const allSolves = await db
      .select({
        id: solves.id,
        teamId: solves.teamId,
        challengeId: solves.challengeId,
        challengeName: challenges.name,
        solvedAt: solves.solvedAt,
      })
      .from(solves)
      .innerJoin(challenges, eq(solves.challengeId, challenges.id))
      .orderBy(asc(solves.solvedAt));

    // 3. Fetch full append-only score_log
    const allLogs = await db
      .select({
        id: scoreLog.id,
        teamId: scoreLog.teamId,
        delta: scoreLog.delta,
        reason: scoreLog.reason,
        actor: scoreLog.actor,
        createdAt: scoreLog.createdAt,
      })
      .from(scoreLog)
      .orderBy(asc(scoreLog.createdAt));

    // Group solves and logs by teamId
    const solvesByTeam = new Map<string, any[]>();
    for (const s of allSolves) {
      if (!solvesByTeam.has(s.teamId)) solvesByTeam.set(s.teamId, []);
      solvesByTeam.get(s.teamId)!.push({
        challenge_id: s.challengeId,
        challenge_name: s.challengeName,
        solved_at: s.solvedAt.toISOString(),
      });
    }

    const logsByTeam = new Map<string, any[]>();
    for (const l of allLogs) {
      if (!logsByTeam.has(l.teamId)) logsByTeam.set(l.teamId, []);
      logsByTeam.get(l.teamId)!.push({
        id: l.id,
        delta: l.delta,
        reason: l.reason,
        actor: l.actor,
        created_at: l.createdAt.toISOString(),
      });
    }

    // Build authoritative ranked records
    const teamRecords = allTeams.map((t) => {
      const teamLogs = logsByTeam.get(t.id) || [];
      const teamSolves = solvesByTeam.get(t.id) || [];

      let scoreDeltaSum = 0;
      let lastActivityAt = t.createdAt.getTime();

      for (const log of teamLogs) {
        scoreDeltaSum += log.delta;
        const logTime = new Date(log.created_at).getTime();
        if (logTime > lastActivityAt) {
          lastActivityAt = logTime;
        }
      }

      const finalScore = 200 + scoreDeltaSum;

      return {
        team_id: t.id,
        team_name: t.teamName,
        team_size: t.teamSize,
        member_emails: t.memberEmails,
        registered_at: t.createdAt.toISOString(),
        final_score: finalScore,
        total_solves: teamSolves.length,
        last_score_change_at: new Date(lastActivityAt).toISOString(),
        solves_timeline: teamSolves,
        score_history: teamLogs,
      };
    });

    // Sort by ground-truth tie-break rules:
    // 1. final_score DESC
    // 2. last_score_change_at ASC (earlier is better)
    // 3. team_name ASC
    teamRecords.sort((a, b) => {
      if (b.final_score !== a.final_score) {
        return b.final_score - a.final_score;
      }
      const timeA = new Date(a.last_score_change_at).getTime();
      const timeB = new Date(b.last_score_change_at).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.team_name.localeCompare(b.team_name);
    });

    // Assign final authoritative rank
    const rankedResults = teamRecords.map((r, idx) => ({
      rank: idx + 1,
      ...r,
    }));

    if (format === 'csv') {
      const headers = ['Rank', 'Team Name', 'Team ID', 'Final Score', 'Total Solves', 'Registered At', 'Last Score Change At'];
      const rows = rankedResults.map((r) => [
        r.rank,
        `"${(String(r.team_name).replace(/^[=+@\-\t\r]/, "'$&")).replace(/"/g, '""')}"`,
        r.team_id,
        r.final_score,
        r.total_solves,
        r.registered_at,
        r.last_score_change_at,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="root-ctf-official-results-${Date.now()}.csv"`);
      return res.status(200).send(csvContent);
    }

    // Default JSON snapshot
    const snapshotPayload = {
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: req.admin!.username,
        total_teams: rankedResults.length,
        total_solves: allSolves.length,
        total_score_events: allLogs.length,
        scoring_model: 'Loss-based: Derived as 200 + SUM(score_log.delta)',
        status: 'OFFICIAL_AUTHORITATIVE_EVENT_RECORD',
      },
      results: rankedResults,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="root-ctf-official-results-${Date.now()}.json"`);
    return res.status(200).json(snapshotPayload);
  } catch (err: any) {
    console.error('[Admin-ExportResults] Failed to generate authoritative snapshot:', err.message);
    return res.status(500).json({ error: 'ExportError', message: 'Failed to generate results snapshot.' });
  }
});

/**
 * ==============================================================================
 * ANNOUNCEMENT BANNER MANAGEMENT (Hardening Section 1)
 * ==============================================================================
 */

/**
 * GET /announcements (or /api/admin/announcements)
 * Admin inspection of all announcements.
 */
adminRouter.get('/announcements', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const list = await db
      .select({
        id: announcements.id,
        message: announcements.message,
        severity: announcements.severity,
        created_at: announcements.createdAt,
        created_by: announcements.createdBy,
        is_active: announcements.isActive,
      })
      .from(announcements)
      .orderBy(desc(announcements.createdAt));

    return res.status(200).json({
      success: true,
      announcements: list.map((a) => ({
        ...a,
        created_at: a.created_at.toISOString(),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * POST /announcements (or /api/admin/announcements)
 * Creates a new broadcast announcement.
 */
adminRouter.post('/announcements', requireAdminAuth, async (req: Request, res: Response) => {
  const { message, severity = 'info' } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Announcement "message" is required and cannot be empty.',
    });
  }

  const validSeverities = ['info', 'warning', 'critical'];
  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      error: 'ValidationError',
      message: `Invalid severity "${severity}". Must be one of: ${validSeverities.join(', ')}`,
    });
  }

  try {
    const [created] = await db
      .insert(announcements)
      .values({
        message: message.trim(),
        severity,
        createdBy: req.admin!.username,
        isActive: true,
      })
      .returning({
        id: announcements.id,
        message: announcements.message,
        severity: announcements.severity,
        createdAt: announcements.createdAt,
        createdBy: announcements.createdBy,
        isActive: announcements.isActive,
      });

    // Invalidate Redis active announcements cache
    await deleteCacheKey('announcements:active');

    return res.status(201).json({
      success: true,
      message: 'Announcement published successfully.',
      announcement: {
        id: created.id,
        message: created.message,
        severity: created.severity,
        created_at: created.createdAt.toISOString(),
        created_by: created.createdBy,
        is_active: created.isActive,
      },
    });
  } catch (err: any) {
    console.error('[Admin-Announcements] Error creating announcement:', err.message);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to create announcement.' });
  }
});

/**
 * POST /announcements/:id/deactivate (or /api/admin/announcements/:id/deactivate)
 * Deactivates an announcement.
 */
adminRouter.post('/announcements/:id/deactivate', requireAdminAuth, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const [updated] = await db
      .update(announcements)
      .set({ isActive: false })
      .where(eq(announcements.id, id))
      .returning({
        id: announcements.id,
        message: announcements.message,
        isActive: announcements.isActive,
      });

    if (!updated) {
      return res.status(404).json({ error: 'NotFound', message: `Announcement "${id}" not found.` });
    }

    // Invalidate Redis active announcements cache
    await deleteCacheKey('announcements:active');

    return res.status(200).json({
      success: true,
      message: 'Announcement deactivated.',
      id: updated.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * ==============================================================================
 * GLOBAL KILL-SWITCH / MAINTENANCE MODE (Hardening Section 2)
 * ==============================================================================
 */

/**
 * GET /maintenance-mode (or /api/admin/maintenance-mode)
 */
adminRouter.get('/maintenance-mode', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const isMaintenance = (await redis.get('platform:maintenance_mode')) === 'true';
    return res.status(200).json({ maintenance: isMaintenance });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * POST /maintenance-mode/on (or /api/admin/maintenance-mode/on)
 * Pauses scoring platform-wide instantly via Redis key. Zero DB writes on flag submit.
 */
adminRouter.post('/maintenance-mode/on', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    await redis.set('platform:maintenance_mode', 'true');
    return res.status(200).json({
      success: true,
      maintenance: true,
      message: 'Platform maintenance mode ENABLED. Flag submissions and hint reveals are paused platform-wide.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * POST /maintenance-mode/off (or /api/admin/maintenance-mode/off)
 * Resumes scoring platform-wide.
 */
adminRouter.post('/maintenance-mode/off', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    await redis.del('platform:maintenance_mode');
    return res.status(200).json({
      success: true,
      maintenance: false,
      message: 'Platform maintenance mode DISABLED. Flag submissions and hint reveals resumed.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * ==============================================================================
 * SCOREBOARD FREEZE (Hardening Section 3)
 * ==============================================================================
 */

/**
 * GET /leaderboard/status (or /api/admin/leaderboard/status)
 */
adminRouter.get('/leaderboard/status', requireAdminAuth, async (_req: Request, res: Response) => {
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
 * POST /leaderboard/freeze (or /api/admin/leaderboard/freeze)
 * Takes a stable snapshot of current public leaderboard and freezes public view.
 */
adminRouter.post('/leaderboard/freeze', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    // 1. Obtain current public leaderboard
    let current = await getCachedLeaderboard();
    if (!current) {
      current = await rebuildLeaderboardCache();
    }

    const publicSnapshot = current.map((entry) => ({
      rank: entry.rank,
      team_name: entry.team_name,
      score: entry.score,
      last_score_change_at: entry.last_score_change_at,
    }));

    // 2. Persist to separate stable freeze key
    await setCachedJson('leaderboard:frozen', publicSnapshot, 86400 * 7);
    const nowIso = new Date().toISOString();
    await redis.set('platform:leaderboard_frozen', 'true');
    await redis.set('platform:leaderboard_frozen_at', nowIso);

    return res.status(200).json({
      success: true,
      frozen: true,
      frozen_at: nowIso,
      message: 'Scoreboard frozen successfully. Scoring continues behind the scenes.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});

/**
 * POST /leaderboard/unfreeze (or /api/admin/leaderboard/unfreeze)
 * Unfreezes scoreboard and refreshes public display.
 */
adminRouter.post('/leaderboard/unfreeze', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    await redis.del('platform:leaderboard_frozen');
    await redis.del('platform:leaderboard_frozen_at');
    await deleteCacheKey('leaderboard:frozen');

    // Rebuild leaderboard cache so public view is refreshed
    await rebuildLeaderboardCache();

    return res.status(200).json({
      success: true,
      frozen: false,
      message: 'Scoreboard unfrozen successfully. Live scores are now public.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
});



// Organisers reset credentials manually; old signed tokens are invalidated by authVersion.
adminRouter.post('/teams/:teamId/reset-password', requireAdminAuth, async (req, res) => {
  const teamId = String(req.params.teamId);
  const { password, reason } = req.body;
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72 || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ message: 'Provide an 8-72 byte password and a reset reason of at least five characters.' });
  }
  try {
    const passwordHash = await hashPassword(password);
    const changed = db.transaction(tx => {
      const rows = tx.update(teams).set({ passwordHash, authVersion: sql`${teams.authVersion} + 1` }).where(eq(teams.id, teamId)).returning({ id: teams.id }).all();
      if (!rows.length) return false;
      appendScoreEvent(teamId, 0, `credential_reset:${reason.trim()}`, req.admin!.username, tx);
      return true;
    });
    if (!changed) return res.status(404).json({ message: 'Team not found.' });
    return res.json({ message: 'Team password reset. Existing team sessions have been revoked.' });
  } catch { return res.status(500).json({ message: 'Unable to reset team credentials.' }); }
});
