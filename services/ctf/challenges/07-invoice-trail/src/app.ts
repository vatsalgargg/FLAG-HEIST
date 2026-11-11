/**
 * Challenge 07 & 08 — Shared Express Application Setup
 *
 * Serves both Challenge 07 (The Invoice Trail) and Challenge 08 (The Internal Dashboard)
 * behind the single shared participant login: priya.nair / Veyra#Audit26.
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRoutes from './routes/auth';
import invoiceRoutes from './routes/invoices';
import dashboardRoutes from './routes/dashboard';
import auditRoutes from './routes/audit';
import resetRoutes from './routes/reset';

export function securityHeadersMiddleware(_req: express.Request, res: express.Response, next: express.NextFunction): void {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  next();
}

export function createApp(): express.Application {
  const app = express();

  app.use(securityHeadersMiddleware);
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => console.log(JSON.stringify({ level: 'info', service: '07-invoice-trail', method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static portal frontend
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // Mount API route groups
  app.use(authRoutes);
  app.use(invoiceRoutes);
  app.use(dashboardRoutes);
  app.use(auditRoutes);
  app.use(resetRoutes);

  // Fallback for SPA routing if needed
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/healthz' || req.path.startsWith('/reset/')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

export default createApp;
