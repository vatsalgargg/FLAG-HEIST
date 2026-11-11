/**
 * Challenge 09 — The Session Bug
 *
 * Microservice implementing an ad-hoc custom cookie session authentication mechanism.
 *
 * MECHANISM:
 * 1. Authenticating issues a base64-encoded cookie: `auth_session = base64("role=user.<checksum>")`.
 * 2. Checksum algorithm is a custom, non-standard keyed polynomial:
 *      checksum = computeCustomChecksum(role, SESSION_BUG_SECRET)
 * 3. The service verifies ONLY the checksum. It never cross-checks the role claim
 *    against an authoritative database or active server-side session table.
 * 4. The algorithm and secret are discoverable via archived legacy source at `/debug/session.js`.
 * 5. Calculating `computeCustomChecksum("admin", SESSION_BUG_SECRET)` and submitting
 *    the forged cookie reveals the flag: ROOT{s3ss10n_ch3cksum_f0rg3ry_b73c}.
 * 6. Implements GET /healthz and POST /reset/9.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const port = parseInt(process.env.CHALLENGE_09_PORT || '3009', 10);
const resetToken = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';
export const sessionSecret = process.env.SESSION_BUG_SECRET || 'k3y_v3yr4_s3ss10n_99';

export const FLAG = 'ROOT{s3ss10n_ch3cksum_f0rg3ry_b73c}';

/**
 * Custom non-standard keyed combination checksum algorithm.
 */
export function computeCustomChecksum(role: string, secret: string): string {
  let acc = 0x5a17;
  const input = `${role}::${secret}`;
  for (let i = 0; i < input.length; i++) {
    acc = ((acc << 5) - acc + input.charCodeAt(i) * (i + 1)) & 0xffffffff;
  }
  return (acc >>> 0).toString(16).padStart(8, '0');
}

export function securityHeadersMiddleware(_req: Request, res: Response, next: express.NextFunction): void {
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

const app = express();
app.use(securityHeadersMiddleware);
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => console.log(JSON.stringify({ level: 'info', service: '09-session-bug', method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 1. Web Portal Interface ──────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra Cloud Solutions — Session Gateway</title>
  <style>
    body { font-family: monospace, sans-serif; background: #0c101a; color: #f1f5f9; padding: 3rem; text-align: center; }
    .card { background: #131b2e; border: 1px solid #1e293b; max-width: 400px; margin: 0 auto; padding: 2rem; border-radius: 8px; }
    h2 { color: #38bdf8; margin-top: 0; }
    input { width: 100%; box-sizing: border-box; background: #080c14; border: 1px solid #334155; padding: 0.75rem; color: #fff; margin-bottom: 1rem; border-radius: 4px; font-family: monospace; }
    button { width: 100%; background: #0284c7; color: #fff; border: none; padding: 0.75rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-family: monospace; }
    button:hover { background: #0369a1; }
  </style>
  <!-- Diagnostic reference: Legacy session validation routine archived at /debug/session.js -->
</head>
<body>
  <div class="card">
    <h2>Veyra Session Gateway</h2>
    <p style="color: #94a3b8; font-size: 0.85rem;">Stateless token verification engine v1.4</p>
    <form method="POST" action="/login">
      <input type="text" name="username" placeholder="Username (e.g. guest)" required autofocus>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Initialize Session</button>
    </form>
  </div>
</body>
</html>`);
});

// ── 2. Archived Debug Source Exposing Checksum Algorithm ─────────────────────
app.get('/debug/session.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`/**
 * Veyra Legacy Custom Session Checksum Routine (Archived)
 *
 * Computes positional additive polynomial checksum over role + cluster secret.
 */
const SESSION_SECRET = "${sessionSecret}";

function computeCustomChecksum(role, secret) {
  let acc = 0x5a17;
  const input = role + "::" + secret;
  for (let i = 0; i < input.length; i++) {
    acc = ((acc << 5) - acc + input.charCodeAt(i) * (i + 1)) & 0xffffffff;
  }
  return (acc >>> 0).toString(16).padStart(8, "0");
}

module.exports = { computeCustomChecksum, SESSION_SECRET };
`);
});

// ── 3. Login Endpoint ────────────────────────────────────────────────────────
app.post('/login', (req: Request, res: Response) => {
  const role = 'user';
  const checksum = computeCustomChecksum(role, sessionSecret);
  const rawCookiePayload = `role=${role}.${checksum}`;
  const base64Cookie = Buffer.from(rawCookiePayload).toString('base64');

  res.cookie('auth_session', base64Cookie, {
    httpOnly: true,
    maxAge: 3600 * 1000,
  });

  return res.redirect('/dashboard');
});

app.post('/api/login', (_req: Request, res: Response) => {
  const role = 'user';
  const checksum = computeCustomChecksum(role, sessionSecret);
  const rawCookiePayload = `role=${role}.${checksum}`;
  const base64Cookie = Buffer.from(rawCookiePayload).toString('base64');

  res.cookie('auth_session', base64Cookie, {
    httpOnly: true,
    maxAge: 3600 * 1000,
  });

  return res.status(200).json({
    success: true,
    message: 'Session established',
    role,
    cookie: base64Cookie,
  });
});

// ── 4. Dashboard Endpoint (Verifies Checksum Only) ───────────────────────────
app.get('/dashboard', (req: Request, res: Response) => {
  const cookieVal = req.cookies.auth_session;
  if (!cookieVal || typeof cookieVal !== 'string') {
    return res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<body style="font-family: monospace; background: #0c101a; color: #f87171; padding: 3rem; text-align: center;">
  <h2>401 Unauthorized</h2>
  <p>Missing auth_session cookie. Please initialize a session at <a href="/" style="color:#38bdf8;">/</a>.</p>
</body>
</html>`);
  }

  let decoded = '';
  try {
    decoded = Buffer.from(cookieVal, 'base64').toString('utf-8');
  } catch {
    return res.status(400).json({ error: 'InvalidEncoding', message: 'Failed to decode base64 session cookie.' });
  }

  // Format: role=<role>.<checksum>
  const match = decoded.match(/^role=([^.]+)\.([a-f0-9]+)$/);
  if (!match) {
    return res.status(400).json({
      error: 'MalformedSession',
      message: 'Session format must be "role=<role>.<checksum>".',
    });
  }

  const roleClaim = match[1];
  const submittedChecksum = match[2];

  // Deep deliberate flaw: verifies ONLY the checksum, never cross-checking role against real account
  const expectedChecksum = computeCustomChecksum(roleClaim, sessionSecret);
  if (submittedChecksum !== expectedChecksum) {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<body style="font-family: monospace; background: #0c101a; color: #f87171; padding: 3rem; text-align: center;">
  <h2>403 Forbidden</h2>
  <p>Session checksum verification failed. Forgery detected.</p>
</body>
</html>`);
  }

  // If role decodes to "admin" with valid checksum, grant flag!
  if (roleClaim === 'admin') {
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra Administrative Gateway</title>
  <style>
    body { font-family: monospace, sans-serif; background: #0c101a; color: #f1f5f9; padding: 3rem; text-align: center; }
    .card { background: #131b2e; border: 1px solid #00d2ff; max-width: 650px; margin: 0 auto; padding: 2rem; border-radius: 8px; }
    h1 { color: #00d2ff; }
    .flag { background: #040914; border: 1px dashed #00d2ff; padding: 1.2rem; font-size: 1.2rem; color: #00d2ff; margin: 1.5rem 0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Veyra Administrative Control Center</h1>
    <p>Session identity verified: <strong>role=admin</strong></p>
    <div class="flag">${FLAG}</div>
  </div>
</body>
</html>`);
  }

  // Normal user dashboard
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra User Dashboard</title>
  <style>
    body { font-family: monospace, sans-serif; background: #0c101a; color: #f1f5f9; padding: 3rem; text-align: center; }
    .card { background: #131b2e; border: 1px solid #1e293b; max-width: 500px; margin: 0 auto; padding: 2rem; border-radius: 8px; }
    h2 { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Standard User Dashboard</h2>
    <p>Session authenticated with: <strong>role=${roleClaim}</strong></p>
    <p style="color: #64748b; font-size: 0.85rem;">Notice: Administrative role required to query cluster system tokens.</p>
  </div>
</body>
</html>`);
});

// JSON API endpoint
app.get('/api/session', (req: Request, res: Response) => {
  const cookieVal = req.cookies.auth_session;
  if (!cookieVal) return res.status(401).json({ authenticated: false, error: 'MissingSession' });

  let decoded = '';
  try {
    decoded = Buffer.from(cookieVal, 'base64').toString('utf-8');
  } catch {
    return res.status(400).json({ error: 'InvalidEncoding' });
  }

  const match = decoded.match(/^role=([^.]+)\.([a-f0-9]+)$/);
  if (!match) return res.status(400).json({ error: 'MalformedSession' });

  const role = match[1];
  const checksum = match[2];
  const expected = computeCustomChecksum(role, sessionSecret);

  if (checksum !== expected) {
    return res.status(403).json({ error: 'InvalidChecksum', message: 'Checksum failed.' });
  }

  if (role === 'admin') {
    return res.status(200).json({ authenticated: true, role, flag: FLAG });
  }

  return res.status(200).json({ authenticated: true, role });
});

// ── 5. Health Probe Hook ─────────────────────────────────────────────────────
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    challenge_id: 9,
    service: 'challenge-09-session-bug',
    time: new Date().toISOString(),
  });
});

// ── 6. Standard Force-Reset Hook ─────────────────────────────────────────────
app.post('/reset/9', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const expectedBearer = `Bearer ${resetToken}`;

  if (!authHeader || authHeader !== expectedBearer) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid reset bearer token',
    });
  }

  return res.status(200).json({
    status: 'ok',
    challenge_id: 9,
    reset_at: new Date().toISOString(),
    message: 'Reset acknowledged. Session configuration synchronized.',
  });
});

export let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`[Challenge-09] Session Bug service running on port ${port}`);
  });
}

export default app;
