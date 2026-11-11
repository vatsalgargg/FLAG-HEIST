/**
 * ROOT CTF — Shared Security Headers Middleware
 *
 * Enforces production-grade defensive HTTP headers across all public endpoints:
 * 1. Content-Security-Policy (CSP)
 * 2. Strict-Transport-Security (HSTS)
 * 3. X-Content-Type-Options (nosniff)
 * 4. X-Frame-Options (DENY)
 * 5. Referrer-Policy (strict-origin-when-cross-origin)
 * 6. Permissions-Policy (restrict browser device capabilities)
 */

import { Request, Response, NextFunction } from 'express';

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // 1. Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );

  // 2. HTTP Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // 3. MIME Sniffing Prevention
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Clickjacking Defense
  res.setHeader('X-Frame-Options', 'DENY');

  // 5. Referrer Protection
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Hardware & Device Feature Restrictions
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  next();
}

export default securityHeadersMiddleware;
