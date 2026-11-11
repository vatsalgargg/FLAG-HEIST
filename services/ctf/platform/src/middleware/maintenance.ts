import { Request, Response, NextFunction } from 'express';
import { redis } from '../cache';

/**
 * Global Kill-Switch / Maintenance Mode Middleware
 *
 * Intercepts write requests (flag submissions, hint reveals) immediately.
 * If `platform:maintenance_mode` is set to 'true' in Redis, returns HTTP 503
 * immediately without consuming rate limit quotas, checking credentials, or touching SQLite.
 */
export async function requireNotMaintenanceMode(req: Request, res: Response, next: NextFunction) {
  try {
    const isMaintenance = (await redis.get('platform:maintenance_mode')) === 'true';
    if (isMaintenance) {
      return res.status(503).json({
        error: 'MaintenanceMode',
        message: 'The platform is temporarily paused, your flag has not been checked — please try again shortly',
      });
    }
  } catch (err: any) {
    console.warn('[Maintenance] Failed to query maintenance status from Redis:', err.message);
    return res.status(503).json({ message: 'Scoring is temporarily unavailable. Please try again shortly.' });
  }
  next();
}
