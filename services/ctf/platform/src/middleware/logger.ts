/**
 * Request Logger Middleware
 *
 * Emits structured JSON logs for incoming requests and response completion.
 * Compatible with Cloud Run / Google Cloud Logging, AWS CloudWatch, and Datadog.
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    // Skip noisy healthz polling logs from automated container health checks
    if (req.path === '/healthz' && res.statusCode === 200) {
      return;
    }

    const durationMs = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}
