/**
 * JWT Issuing & Verification Module
 *
 * ARCHITECTURAL RATIONALE: WHY JWT OVER SERVER-SIDE SESSIONS?
 * "No database or cache read is required just to check 'is this request authenticated' —
 * the signature alone proves it, which keeps the hottest code path (every single request)
 * as cheap as possible under high concurrency."
 *
 * With 5,000–10,000 active concurrent sessions across 25 autoscaling Cloud Run instances,
 * verifying an HMAC signature in CPU memory requires 0 network calls, 0 DB roundtrips,
 * and 0 Redis operations, allowing the platform to scale out effortlessly on free/low-cost tiers.
 *
 * CRITICAL SECURITY INVARIANT: TEAM VS ADMIN SEPARATION
 * ==============================================================================
 * "These two token types must never be verifiable by each other's secret, and
 * application code must never accept an admin token on a team route or vice versa,
 * even if someone tries — write a short explicit check for this, don't just rely
 * on different claim shapes."
 * ==============================================================================
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';

// 72-hour lifetime precisely matches the 3-day continuous CTF competition window.
// Participants log in once at kickoff and stay logged in throughout the event.
const EVENT_DURATION_HOURS = '72h';

export interface TeamTokenPayload {
  id: string;
  teamName: string;
  type: 'team';
  authVersion: number;
}

export interface AdminTokenPayload {
  id: string;
  username: string;
  role: string;
  type: 'admin';
}

function getTeamSecret(): string {
  if (config.jwtSecret) {
    return config.jwtSecret;
  }
  if (config.nodeEnv === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be configured in production!');
  }
  // Dedicated development fallback secret
  return 'dev-team-jwt-secret-do-not-use-in-production-1234567890';
}

function getAdminSecret(): string {
  if (config.adminJwtSecret) {
    return config.adminJwtSecret;
  }
  if (config.nodeEnv === 'production') {
    throw new Error('FATAL SECURITY ERROR: ADMIN_JWT_SECRET must be configured in production!');
  }
  // Dedicated development fallback secret — strictly distinct from team secret
  return 'dev-admin-jwt-secret-do-not-use-in-production-0987654321';
}

/**
 * Issues a signed JWT for a participant team.
 */
export function issueTeamToken(team: { id: string; teamName: string; authVersion?: number }): string {
  const payload: TeamTokenPayload = {
    id: team.id,
    teamName: team.teamName,
    type: 'team',
    authVersion: team.authVersion ?? 0,
  };

  const options: SignOptions = {
    expiresIn: EVENT_DURATION_HOURS,
    algorithm: 'HS256',
  };

  return jwt.sign(payload, getTeamSecret(), options);
}

/**
 * Verifies a participant team JWT.
 * Fails closed if the token is invalid, expired, tampered, or is an admin token.
 */
export function verifyTeamToken(token: string): TeamTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = jwt.verify(token, getTeamSecret(), {
      algorithms: ['HS256'],
    }) as any;

    // Explicit Type Guard: Reject admin tokens even if signed under a matching key
    if (!decoded || decoded.type !== 'team' || !decoded.id || !decoded.teamName) {
      return null;
    }

    return {
      id: decoded.id,
      teamName: decoded.teamName,
      type: 'team',
      authVersion: decoded.authVersion ?? 0,
    };
  } catch (err) {
    // Expired, malformed, or bad signature -> return null
    return null;
  }
}

/**
 * Issues a signed JWT for an event administrator.
 * Signed with ADMIN_JWT_SECRET.
 */
export function issueAdminToken(admin: { id: string; username: string; role?: string }): string {
  const payload: AdminTokenPayload = {
    id: admin.id,
    username: admin.username,
    role: admin.role || 'admin',
    type: 'admin',
  };

  const options: SignOptions = {
    expiresIn: EVENT_DURATION_HOURS,
    algorithm: 'HS256',
  };

  return jwt.sign(payload, getAdminSecret(), options);
}

/**
 * Verifies an administrator JWT.
 * Fails closed if the token is invalid, expired, tampered, or is a team token.
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = jwt.verify(token, getAdminSecret(), {
      algorithms: ['HS256'],
    }) as any;

    // Explicit Type Guard: Reject team tokens even if signed under a matching key
    if (!decoded || decoded.type !== 'admin' || !decoded.id || !decoded.username) {
      return null;
    }

    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'admin',
      type: 'admin',
    };
  } catch (err) {
    // Expired, malformed, or bad signature -> return null
    return null;
  }
}
