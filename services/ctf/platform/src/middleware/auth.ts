/**
 * Authentication & Authorization Middleware
 *
 * Provides `requireTeamAuth` and `requireAdminAuth` middleware guards.
 *
 * SECURITY INVARIANT:
 * Team tokens and Admin tokens are strictly non-interchangeable.
 * - An admin token used on a team route will be rejected.
 * - A team token used on an admin route will be rejected.
 */

import { db, teams } from '../db';
import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import { verifyTeamToken, verifyAdminToken, TeamTokenPayload, AdminTokenPayload } from '../auth/tokens';
import { TEAM_COOKIE_NAME, ADMIN_COOKIE_NAME } from '../auth/cookies';

// Extend Express Request interface to carry authenticated context
declare global {
  namespace Express {
    interface Request {
      team?: TeamTokenPayload;
      admin?: AdminTokenPayload;
    }
  }
}

function extractToken(req: Request, cookieName: string): string | null {
  // 1. Primary: HttpOnly session cookie
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  // 2. Fallback: Authorization: Bearer <token> header (convenient for API tooling/tests)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Middleware: Requires a valid participant team session.
 * Protects participant endpoints (dashboard, submit flag, reveal hints).
 */
export async function requireTeamAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req, TEAM_COOKIE_NAME);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in as a team.',
    });
    return;
  }

  const payload = verifyTeamToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid, expired, or unauthorized team session token.',
    });
    return;
  }

  try {
    const [team] = await db.select({ authVersion: teams.authVersion }).from(teams).where(eq(teams.id, payload.id)).limit(1);
    if (!team || team.authVersion !== payload.authVersion) {
      res.status(401).json({ message: 'Team session expired. Please log in again.' }); return;
    }
  } catch (err) { next(err); return; }
  req.team = payload;
  next();
}

/**
 * Middleware: Requires a valid administrator session.
 * Protects administrative routes (/admin/*).
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req, ADMIN_COOKIE_NAME);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Administrator authentication required.',
    });
    return;
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid, expired, or unauthorized admin session token.',
    });
    return;
  }

  req.admin = payload;
  next();
}
