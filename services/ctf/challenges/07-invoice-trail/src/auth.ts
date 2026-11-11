/**
 * Challenge 07 & 08 — Portal Authentication & Session Middleware
 *
 * ARCHITECTURAL SPECIFICATION:
 * ==============================================================================
 * This service implements its own standalone session authentication using an
 * HMAC-signed session cookie (`veyra_portal_session`), completely isolated from
 * the scoring platform's JWT system.
 *
 * Why this auth is isolated from the platform:
 * This challenge's session system is itself just a normal, correctly-implemented
 * login (not the vulnerability here), so there's no reason to share infrastructure
 * with the platform's auth.
 *
 * Public Challenge Credentials:
 * Exactly ONE seeded participant account exists per spec:
 *   Username: priya.nair
 *   Password: Veyra#Audit26
 * These credentials are fixed, public challenge materials published to all
 * participants, not secrets to protect.
 * ==============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function getPriyaUsername(): string {
  return process.env.PRIYA_USERNAME || 'priya.nair';
}

export function getPriyaPassword(): string {
  return process.env.PRIYA_PASSWORD || 'Veyra#Audit26';
}

export const PRIYA_USERNAME = 'priya.nair';
export const PRIYA_PASSWORD = 'Veyra#Audit26';

export const PORTAL_SESSION_SECRET = process.env.PORTAL_SESSION_SECRET || 'veyra-portal-secret-key-audit-2026';
export const SESSION_COOKIE_NAME = 'veyra_portal_session';

export interface PortalUserSession {
  username: string;
  name: string;
  role: string;
  customerId: number;
  issuedAt: number;
}

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalUserSession;
    }
  }
}

/**
 * Creates an HMAC-SHA256 signed session token
 */
export function signSession(session: PortalUserSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', PORTAL_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token
 */
export function verifySession(token: string): PortalUserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', PORTAL_SESSION_SECRET)
      .update(payload)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    // Enforce 72-hour session lifetime
    if (!decoded.issuedAt || Date.now() - decoded.issuedAt > 72 * 60 * 60 * 1000) {
      return null;
    }
    return decoded as PortalUserSession;
  } catch {
    return null;
  }
}

/**
 * Middleware: Requires a valid portal session cookie.
 */
export function requirePortalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers['x-portal-session'] as string;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required. Please log in.' });
    return;
  }

  const user = verifySession(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session. Please log in again.' });
    return;
  }

  req.portalUser = user;
  next();
}

/**
 * Middleware: Requires a specific role or admin permission.
 * Correctly protected routes use this to deny unauthorized access.
 */
export function requirePortalPermission(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.portalUser) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (req.portalUser.role !== requiredRole && req.portalUser.role !== 'admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied: requires ${requiredRole} permission. Current role: ${req.portalUser.role}`,
      });
      return;
    }

    next();
  };
}
