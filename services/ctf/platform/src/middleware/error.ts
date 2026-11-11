import * as Sentry from '@sentry/node';
/**
 * Centralized Error Handling Middleware
 *
 * Ensures all unexpected application errors produce clean, structured JSON
 * responses without leaking internal stack traces in production.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const isProduction = config.nodeEnv === 'production';

  const responseBody = {
    error: err.name || 'InternalServerError',
    message: isProduction && statusCode === 500 ? 'An unexpected internal error occurred' : err.message,
    statusCode,
    ...(isProduction ? {} : { stack: err.stack }),
  };

  console.error('[ErrorMiddleware] Unhandled exception:', {
    message: err.message,
    stack: err.stack,
    statusCode,
  });

  if (config.sentryDsn && statusCode >= 500) Sentry.captureException(err);

  res.status(statusCode).json(responseBody);
}
