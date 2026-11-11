import * as Sentry from '@sentry/node';
import { config } from './config';
/**
 * Express Application Configuration
 *
 * Configures global middleware, CORS, cookie parsing, routes, and error handling.
 */

import express, { Application, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { routes } from './routes';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/error';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { isAllowedPlatformOrigin } from './middleware/platformOrigin';

export function createApp(): Application {
  if (config.sentryDsn && !Sentry.isInitialized()) Sentry.init({ dsn: config.sentryDsn, defaultIntegrations: false });
  const app = express();

  // Basic security and parsing middleware
  app.set('trust proxy', 1); // Respect Cloudflare / Cloud Run reverse proxy headers
  app.use(securityHeadersMiddleware);
  // Production stays restricted; development supports local and proxied app previews.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = process.env.PLATFORM_ORIGIN || 'http://localhost:3000';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && !isAllowedPlatformOrigin(origin, allowed, config.nodeEnv === 'production', req.get('x-forwarded-host'))) {
      return res.status(403).json({ message: 'Cross-origin requests are not allowed.' });
    }
    if (req.path.startsWith('/api/') && !['/api/leaderboard', '/api/announcements', '/api/status', '/api/stats/solves'].includes(req.path)) {
      res.setHeader('Cache-Control', 'private, no-store');
    }
    next();
  });
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use((_req, res, next) => {
    res.on('finish', () => { if (config.sentryDsn && res.statusCode >= 500) Sentry.captureException(new Error(`API response ${res.statusCode}`)); });
    next();
  });

  // Observability
  app.use(requestLogger);

  // 2. Static challenge downloads (CDN-style edge hosting)
  app.use('/artifacts/ch02', express.static(path.resolve(__dirname, '../../challenges/02-broken-lock/artifacts')));
  app.use('/artifacts/ch06', express.static(path.resolve(__dirname, '../../challenges/06-leaked-photo/artifacts')));
  app.use('/artifacts/ch08', express.static(path.resolve(__dirname, '../../challenges/08-internal-dashboard/artifacts')));
  app.use('/artifacts/ch11', express.static(path.resolve(__dirname, '../../challenges/11-debug-trace/artifacts')));

  // 3. Mount API router
  app.use('/', routes);

  // 5. 404 handler for unrecognized routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NotFound',
      message: `Endpoint ${req.method} ${req.originalUrl} not found on this server`,
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
