/**
 * In-Memory Authentication Rate Limiter & Lockout Guard
 *
 * Provides IP-level rate limiting and credential brute-force protection.
 *
 * ARCHITECTURAL NOTE:
 * This in-memory implementation provides immediate, zero-latency protection per instance.
 * In Prompt 8 (Rate Limiting & Abuse Guards), this will be supplemented with distributed
 * Redis token-bucket keys (`rate_limit:ip:auth`) to enforce global limits across multiple
 * autoscaling Cloud Run containers.
 *
 * BRUTE-FORCE DEFENSE:
 * If an automated script attempts to brute-force a team's password, 5 failed attempts
 * for the same `team_name` triggers a temporary 5-minute lockout. This makes large-scale
 * password guessing computationally impractical while keeping accidental typos easy to recover.
 */

import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  resetAt: number;
}

// In-memory buckets for IP-based throttling, partitioned by prefix
const ipBuckets = new Map<string, AttemptRecord>();

// In-memory tracking of failed attempts per team_name
const failedTeamAttempts = new Map<string, AttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates an Express middleware to rate limit by client IP.
 */
export function ipRateLimiter(options: { prefix?: string; windowMs: number; max: number; message: string }) {
  const prefix = options.prefix || 'default';

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${prefix}:${ip}`;
    const now = Date.now();

    const record = ipBuckets.get(key);
    if (!record || now > record.resetAt) {
      ipBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.set('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        error: 'TooManyRequests',
        message: options.message,
        retryAfter: retryAfterSec,
      });
      return;
    }

    record.count += 1;
    next();
  };
}

/**
 * Checks if a specific team name is temporarily locked out due to excessive failed logins.
 */
export function isTeamLockedOut(teamName: string): { locked: boolean; remainingSec: number } {
  const normalized = teamName.trim().toLowerCase();
  const record = failedTeamAttempts.get(normalized);
  if (!record) {
    return { locked: false, remainingSec: 0 };
  }

  const now = Date.now();
  if (now > record.resetAt) {
    failedTeamAttempts.delete(normalized);
    return { locked: false, remainingSec: 0 };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const remainingSec = Math.ceil((record.resetAt - now) / 1000);
    return { locked: true, remainingSec };
  }

  return { locked: false, remainingSec: 0 };
}

/**
 * Records a failed login attempt for a team name.
 */
export function recordFailedTeamAttempt(teamName: string): void {
  const normalized = teamName.trim().toLowerCase();
  const now = Date.now();
  const record = failedTeamAttempts.get(normalized);

  if (!record || now > record.resetAt) {
    failedTeamAttempts.set(normalized, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS });
  } else {
    record.count += 1;
  }
}

/**
 * Clears failed login attempts for a team name after a successful login.
 */
export function resetFailedTeamAttempts(teamName: string): void {
  const normalized = teamName.trim().toLowerCase();
  failedTeamAttempts.delete(normalized);
}

// Clean up stale in-memory records periodically to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipBuckets.entries()) {
    if (now > record.resetAt) ipBuckets.delete(key);
  }
  for (const [key, record] of failedTeamAttempts.entries()) {
    if (now > record.resetAt) failedTeamAttempts.delete(key);
  }
}, 60000).unref();
