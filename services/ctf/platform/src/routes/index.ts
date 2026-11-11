/**
 * Main Application Router
 *
 * Mounts the critical /healthz probe and REST API routers.
 * Supports both /api/auth and /auth prefixes for client compatibility.
 */

import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth';
import { dashboardRouter } from './dashboard';
import { leaderboardRouter } from './leaderboard';
import { submitRouter } from './submit';
import { hintsRouter } from './hints';
import { adminRouter } from './admin';
import { announcementsRouter } from './announcements';
import { statusRouter } from './status';
import { statsRouter } from './stats';

export const routes = Router();

// Active health check endpoint
routes.use(healthRouter);

// Public status page endpoint
routes.use('/api/status', statusRouter);
routes.use('/status', (req, res, next) => {
  if (req.headers.accept?.includes('text/html') || req.headers['sec-fetch-dest'] === 'document') {
    return next(); // Hand over to SPA HTML fallback
  }
  return statusRouter(req, res, next);
});

// Competition statistics endpoints
routes.use('/api/stats', statsRouter);
routes.use('/stats', statsRouter);

// Public announcements broadcast routes
routes.use('/api/announcements', announcementsRouter);
routes.use('/announcements', announcementsRouter);

// Authentication routes (supporting /api/auth/* and /auth/*)
routes.use('/api/auth', authRouter);
routes.use('/auth', authRouter);

// Administrator routes (supporting /api/admin/* and /admin/*)
routes.use('/api/admin', adminRouter);
routes.use('/admin', adminRouter);

// Dashboard routes
routes.use('/api/dashboard', dashboardRouter);
routes.use('/dashboard', (req, res, next) => {
  if (req.headers.accept?.includes('text/html') || req.headers['sec-fetch-dest'] === 'document') {
    return next(); // Hand over to SPA HTML fallback
  }
  return dashboardRouter(req, res, next);
});

// Leaderboard routes
routes.use('/api/leaderboard', leaderboardRouter);
routes.use('/leaderboard', (req, res, next) => {
  if (req.headers.accept?.includes('text/html') || req.headers['sec-fetch-dest'] === 'document') {
    return next(); // Hand over to SPA HTML fallback
  }
  return leaderboardRouter(req, res, next);
});

routes.use('/api/submit', submitRouter);
routes.use('/submit', submitRouter);

routes.use('/api/hints', hintsRouter);
routes.use('/hints', hintsRouter);
routes.use('/api/challenges/:challengeId/hints', (req, res, next) => {
  req.url = `/${req.params.challengeId}`;
  return hintsRouter(req, res, next);
});
