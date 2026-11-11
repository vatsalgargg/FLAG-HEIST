/**
 * Health Check Route (/healthz)
 *
 * The single most critical observability endpoint in the entire system.
 * Used by load balancers, Cloud Run health probes, and uptime monitors.
 *
 * CRITICAL REQUIREMENT:
 * This endpoint is HONEST. It returns HTTP 200 ONLY when both the SQLite
 * database and Redis cache are actively reachable. If either dependency fails,
 * it returns HTTP 503 so that container orchestrators can route traffic away
 * or restart unhealthy instances.
 */

import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../db';
import { checkRedisHealth } from '../cache';

export const healthRouter = Router();

healthRouter.get('/healthz', async (_req: Request, res: Response) => {
  const [dbHealth, cacheHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const allHealthy = dbHealth.ok && cacheHealth.ok;
  const statusCode = allHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'error',
    service: 'platform',
    time: new Date().toISOString(),
    dependencies: {
      database: dbHealth.ok
        ? 'connected'
        : `unreachable: ${dbHealth.error || 'connection failed'}`,
      redis: cacheHealth.ok
        ? 'connected'
        : `unreachable: ${cacheHealth.error || 'connection failed'}`,
    },
    latency: {
      databaseMs: dbHealth.latencyMs,
      redisMs: cacheHealth.latencyMs,
    },
  });
});
