/**
 * Authentication REST Routes (/api/auth/* and /auth/*)
 *
 * Implements team-level login, session inspection (/me), and logout.
 *
 * DESIGN CONSTRAINTS:
 * 1. JWT sessions are checked against the current database auth version so organiser
 *    password resets invalidate previously issued tokens.
 * 2. Enumeration Defense: Login returns the identical generic message ("Invalid team leader email or password")
 *    whether the team does not exist or the password is incorrect.
 * 3. Lockout Defense: Repeated failed logins against a single leader email trigger a temporary lockout.
 */

import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db, teams } from '../db';
import { verifyPassword } from '../auth/password';
import { issueTeamToken } from '../auth/tokens';
import { setTeamCookie, clearTeamCookie } from '../auth/cookies';
import {
  isTeamLockedOut,
  recordFailedTeamAttempt,
  resetFailedTeamAttempts,
} from '../auth/rateLimit';
import { requireTeamAuth } from '../middleware/auth';
import { createRateLimiter, RATE_LIMIT_CONFIG } from '../middleware/rateLimiter';

export const authRouter = Router();

// Plausible email validation pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Distributed Redis rate limiters for auth endpoints (shared across all platform instances)
const loginLimiter = createRateLimiter(RATE_LIMIT_CONFIG.teamLogin);

// Team accounts are provisioned by organisers, never through public registration.
authRouter.post('/register', (_req: Request, res: Response) => {
  res.status(403).json({ message: 'Team accounts are created by event organisers.' });
});

/**
 * POST /login (or /api/auth/login)
 *
 * Team login endpoint.
 * Accepts: leader_email, password.
 */
authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const leader_email = req.body.leader_email;
  const password = req.body.password;

  if (typeof leader_email !== 'string' || leader_email.length > 254 || !EMAIL_REGEX.test(leader_email.trim()) || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'A valid team leader email and password are required.',
    });
  }

  const leaderEmail = leader_email.trim().toLowerCase();

  // Brute-force lockout check
  const lockout = isTeamLockedOut(leaderEmail);
  if (lockout.locked) {
    res.set('Retry-After', lockout.remainingSec.toString());
    return res.status(429).json({
      error: 'TooManyRequests',
      message: `Too many failed login attempts for this team. Please wait ${lockout.remainingSec} seconds before trying again.`,
      retryAfter: lockout.remainingSec,
    });
  }

  try {
    const matches = await db
      .select({
        id: teams.id,
        teamName: teams.teamName,
        authVersion: teams.authVersion,
        teamSize: teams.teamSize,
        passwordHash: teams.passwordHash,
      })
      .from(teams)
      // The first JSON member email is the designated team leader.
      .where(sql`lower(json_extract(${teams.memberEmails}, '$[0]')) = ${leaderEmail}`)
      .limit(2);

    const team = matches.length === 1 ? matches[0] : undefined;

    // SECURITY: Use identical error for non-existent team and bad password to block user enumeration
    if (!team) {
      recordFailedTeamAttempt(leaderEmail);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid team leader email or password',
      });
    }

    const isValidPassword = await verifyPassword(password, team.passwordHash);
    if (!isValidPassword) {
      recordFailedTeamAttempt(leaderEmail);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid team leader email or password',
      });
    }

    // Successful login: reset failed attempt counter
    resetFailedTeamAttempts(leaderEmail);

    // Issue JWT and set session cookie
    const token = issueTeamToken({
      id: team.id,
      teamName: team.teamName,
      authVersion: team.authVersion,
    });
    setTeamCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      team: {
        id: team.id,
        teamName: team.teamName,
        teamSize: team.teamSize,
      },
    });
  } catch (err: any) {
    console.error('[Auth-Login] Unexpected error:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Login processing failed. Please try again.',
    });
  }
});

/**
 * GET /me (or /api/auth/me)
 *
 * Session inspection endpoint.
 * Reads the httpOnly cookie and returns authenticated team context.
 * The frontend dashboard calls this on initial load to determine whether
 * to render the competition dashboard or redirect to login.
 */
authRouter.get('/me', requireTeamAuth, (req: Request, res: Response) => {
  return res.status(200).json({
    authenticated: true,
    team: {
      id: req.team!.id,
      teamName: req.team!.teamName,
    },
  });
});

/**
 * POST /logout (or /api/auth/logout)
 *
 * Logout endpoint.
 *
 * NOTE ON JWT STATELESS LOGOUT:
 * Because the platform uses stateless JWTs without server-side session tables,
 * "logout" clears the session cookie from the client's browser. The token signature
 * remains technically cryptographically valid until its 72-hour expiry if captured
 * and replayed over the wire. This is an explicit, accepted engineering tradeoff
 * for an ephemeral 3-day CTF event that avoids millions of database lookups under load.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  clearTeamCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});
