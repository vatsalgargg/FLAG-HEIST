/**
 * Shared Distributed Redis Rate Limiter Middleware
 *
 * Replaces per-instance in-memory rate limiter stubs with a globally shared,
 * distributed rate limiter backed by Redis.
 *
 * ARCHITECTURAL DESIGN:
 * ==============================================================================
 * In a multi-instance production environment (e.g., autoscaling Google Cloud Run
 * containers behind Cloudflare / Google Cloud Load Balancer):
 * - An in-memory rate limiter only tracks requests hitting THAT single container instance.
 * - An attacker or automated brute-force script hammering 5 container instances
 *   would see their effective request allowance multiplied by 5x.
 * - This shared Redis rate limiter ensures all container instances share a single,
 *   authoritative counter per team/IP.
 *
 * ATOMIC LUA INCR + EXPIRE PATTERN:
 * ==============================================================================
 * We execute an atomic Lua script that increments the key and sets its expiry on
 * the first increment:
 *
 *   local current = redis.call('INCR', KEYS[1])
 *   if current == 1 then
 *     redis.call('EXPIRE', KEYS[1], ARGV[1])
 *   end
 *   local ttl = redis.call('TTL', KEYS[1])
 *   return {current, ttl}
 *
 * Why this specific pattern is both correct and cheap:
 * 1. Single Round Trip: INCR, EXPIRE, and TTL check happen on the Redis server
 *    in a single atomic round trip (~0.5ms).
 * 2. Zero Race Conditions: Since Redis executes Lua scripts atomically, there is
 *    no "read-then-write" race condition between multiple concurrent platform instances.
 * 3. Self-Cleaning: The key automatically expires after `windowSeconds`, avoiding
 *    unbounded memory growth in Redis.
 *
 * FAIL-OPEN AVAILABILITY CONTRACT:
 * ==============================================================================
 * If Redis is temporarily unreachable or throws a network error:
 * - NEVER block participant or admin traffic (failing closed would convert a minor
 *   cache blip into a catastrophic full-platform outage).
 * - Instead, FAIL OPEN: Log a warning and allow the request through (`next()`).
 * - Cloudflare's edge-level WAF and rate limiting (configured in DNS/edge CDN)
 *   remains active as the outer defense layer regardless.
 * ==============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../cache';

// Centralized tuning configuration for all rate-limited routes
export const RATE_LIMIT_CONFIG = {
  // Team registration: 15 attempts per minute per IP (prevents account generation spam)
  teamRegister: {
    keyPrefix: 'auth_register',
    maxRequests: 15,
    windowSeconds: 60,
    message: 'Too many registration requests. Please wait a moment before trying again.',
  },
  // Team login: 30 attempts per minute per IP (prevents rapid credential testing)
  teamLogin: {
    keyPrefix: 'auth_login',
    maxRequests: 30,
    windowSeconds: 60,
    message: 'Too many login attempts. Please wait a moment before trying again.',
  },
  // Administrator login: 10 attempts per minute per IP (tight brute-force guard for privileged access)
  adminLogin: {
    keyPrefix: 'admin_login',
    maxRequests: 10,
    windowSeconds: 60,
    message: 'Too many administrator login attempts. Please wait before retrying.',
  },
  // Flag submission: 15 attempts per minute per team (blocks automated brute-forcing of flags)
  flagSubmit: {
    keyPrefix: 'flag_submit',
    maxRequests: 15,
    windowSeconds: 60,
    message: 'Too many flag submissions. Please wait before submitting another flag.',
  },
};

export interface RateLimiterOptions {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

// Atomic Lua script for fixed-window rate limiting
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

/**
 * Creates an Express middleware enforcing a distributed rate limit via Redis.
 */
export function createRateLimiter(options: {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}) {
  const { keyPrefix, maxRequests, windowSeconds, keyGenerator, message } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let redisKey = `ratelimit:${keyPrefix}:unknown`;
    try {
      // 1. Resolve rate limit subject identifier
      let identifier = 'unknown';
      if (keyGenerator) {
        identifier = keyGenerator(req);
      } else if (req.team?.id) {
        // For authenticated team routes, rate limit by team ID so limits persist across IP hops
        identifier = `team:${req.team.id}`;
      } else {
        // For unauthenticated routes, rate limit by IP address
        const forwarded = req.headers['x-forwarded-for'];
        const ip = typeof forwarded === 'string'
          ? forwarded.split(',')[0].trim()
          : req.ip || req.socket.remoteAddress || 'unknown';
        identifier = `ip:${ip}`;
      }

      redisKey = `ratelimit:${keyPrefix}:${identifier}`;

      // 2. Execute atomic Lua INCR + EXPIRE
      const result = (await redis.eval(
        RATE_LIMIT_LUA,
        1,
        redisKey,
        windowSeconds.toString()
      )) as [number, number];

      const currentCount = result[0];
      const remainingTtl = result[1] > 0 ? result[1] : windowSeconds;

      // Set standard rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount).toString());
      res.setHeader('X-RateLimit-Reset', remainingTtl.toString());

      // 3. Limit Check
      if (currentCount > maxRequests) {
        res.setHeader('Retry-After', remainingTtl.toString());
        res.status(429).json({
          error: 'TooManyRequests',
          message: message || `Too many requests. Please try again in ${remainingTtl} seconds.`,
          retryAfter: remainingTtl,
        });
        return;
      }

      return next();
    } catch (err: any) {
      // 4. FAIL OPEN: Never crash or deny traffic if Redis has a hiccup
      console.warn(
        `[RateLimiter] WARNING: Redis error while checking rate limit for "${redisKey}". Failing open:`,
        err.message
      );
      return next();
    }
  };
}
