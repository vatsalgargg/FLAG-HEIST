/**
 * Public Status Page API (/api/status and /status)
 *
 * HARDENING SPECIFICATION — SECTION 7: PUBLIC STATUS PAGE
 * Aggregates real operational health of:
 * 1. The scoring platform itself (uptime, heap, RSS)
 * 2. SQLite database (query health and latency)
 * 3. Redis cache (reachability, latency, memory)
 * 4. All 13 training modules (dynamic targets queried via /healthz, static targets verified)
 * 5. Collaborator logging service (queried via /healthz)
 *
 * CRITICAL PERFORMANCE GUARANTEE:
 * Aggregated status is cached in Redis ('platform:status_page') for 20 seconds.
 * 20,000 participants refreshing the status page during an incident CANNOT cause
 * a secondary outage by hammering 14 backend health endpoints simultaneously.
 */

import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../db';
import { checkRedisHealth, getCachedJson, setCachedJson } from '../cache';
import { CHALLENGE_SERVICES, getChallengeBaseUrl } from '../config/challengeUrls';

export const statusRouter = Router();

const STATUS_CACHE_KEY = 'platform:status_page';
const STATUS_CACHE_TTL = 20; // 20 seconds cache

interface ServiceHealth {
  name: string;
  category: 'core' | 'database' | 'cache' | 'challenge' | 'infrastructure';
  status: 'operational' | 'degraded' | 'down';
  latencyMs: number;
  message?: string;
  details?: Record<string, any>;
}

export async function aggregateSystemStatus() {
  const cached = await getCachedJson<any>(STATUS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const startTotal = Date.now();
  const services: ServiceHealth[] = [];

  // 1. Scoring Platform Core
  const mem = process.memoryUsage();
  services.push({
    name: 'Scoring Platform API',
    category: 'core',
    status: 'operational',
    latencyMs: 1,
    details: {
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
  });

  // 2. SQLite Database
  const dbHealth = await checkDatabaseHealth();
  services.push({
    name: 'SQLite Ground-Truth DB',
    category: 'database',
    status: dbHealth.ok ? 'operational' : 'down',
    latencyMs: dbHealth.latencyMs,
    message: dbHealth.error,

  });

  // 3. Redis Cache Layer
  const redisHealth = await checkRedisHealth();
  services.push({
    name: 'Redis Fast-Path Cache',
    category: 'cache',
    status: redisHealth.ok ? 'operational' : 'down',
    latencyMs: redisHealth.latencyMs,
    message: redisHealth.error,
  });

  // 4. Collaborator Service
  const collabUrl = process.env.COLLAB_URL || 'http://localhost:8082';
  try {
    const startCollab = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${collabUrl.replace(/\/+$/, '')}/healthz`, { signal: ctrl.signal });
    clearTimeout(timer);
    const latency = Date.now() - startCollab;
    services.push({
      name: 'Collaborator Logging Service',
      category: 'infrastructure',
      status: res.ok ? 'operational' : 'degraded',
      latencyMs: latency,
    });
  } catch {
    services.push({
      name: 'Collaborator Logging Service',
      category: 'infrastructure',
      status: 'degraded',
      latencyMs: 0,
      message: 'Collab service ping timed out or offline',
    });
  }

  // 5. All 13 Challenge Targets
  const challengeChecks = Object.entries(CHALLENGE_SERVICES).map(async ([rawId, cfg]) => {
    const chId = parseInt(rawId, 10);
    if (!cfg.isDynamic && !getChallengeBaseUrl(chId)) {
      const dirs: Record<number, string> = { 2: '02-broken-lock', 6: '06-leaked-photo', 11: '11-debug-trace' };
      const available = dirs[chId] && fs.existsSync(path.resolve(__dirname, '../../../challenges', dirs[chId], 'artifacts'));

      return {
        name: `Ch #${chId}: ${cfg.name}`,
        category: 'challenge' as const,
        status: available ? ('operational' as const) : ('degraded' as const),
        latencyMs: 0,
        message: available ? undefined : 'Static assets or external target need configuration',
        details: { type: 'static_cdn' },
      };
    }

    const baseUrl = getChallengeBaseUrl(chId);
    if (!baseUrl) {
      return {
        name: `Ch #${chId}: ${cfg.name}`,
        category: 'challenge' as const,
        status: 'degraded' as const,
        latencyMs: 0,
        message: 'No service base URL configured',
      };
    }

    const startCh = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1200);
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/healthz`, { signal: ctrl.signal });
      clearTimeout(timer);
      const latency = Date.now() - startCh;
      return {
        name: `Ch #${chId}: ${cfg.name}`,
        category: 'challenge' as const,
        status: res.ok ? ('operational' as const) : ('degraded' as const),
        latencyMs: latency,
        details: { type: 'microservice' },
      };
    } catch {
      return {
        name: `Ch #${chId}: ${cfg.name}`,
        category: 'challenge' as const,
        status: 'degraded' as const,
        latencyMs: 0,
        message: 'Health probe unresponsive',
      };
    }
  });

  const challengeResults = await Promise.all(challengeChecks);
  services.push(...challengeResults);

  // Compute Overall Platform Health
  const hasDown = services.some((s) => (s.category === 'core' || s.category === 'database') && s.status === 'down');
  const hasDegraded = services.some((s) => s.status !== 'operational');

  let overallStatus: 'operational' | 'degraded' | 'outage' = 'operational';
  let overallMessage = 'All Systems Operational';

  if (hasDown) {
    overallStatus = 'outage';
    overallMessage = 'Major System Outage';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
    overallMessage = 'Experiencing Degraded Performance';
  }

  const payload = {
    overall_status: overallStatus,
    message: overallMessage,
    checked_at: new Date().toISOString(),
    evaluation_duration_ms: Date.now() - startTotal,
    services,
  };

  await setCachedJson(STATUS_CACHE_KEY, payload, STATUS_CACHE_TTL);
  return payload;
}

/**
 * GET /api/status (or /status)
 */
statusRouter.get('/', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15, stale-while-revalidate=15');

  try {
    const status = await aggregateSystemStatus();
    return res.status(200).json(status);
  } catch (err: any) {
    console.error('[Status] Failed to evaluate system health:', err.message);
    return res.status(500).json({
      error: 'StatusCheckFailed',
      message: 'Failed to aggregate platform system status.',
    });
  }
});
