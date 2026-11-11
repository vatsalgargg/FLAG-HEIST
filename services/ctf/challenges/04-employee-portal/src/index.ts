/**
 * Challenge 04 — The Employee Portal
 *
 * Microservice implementing the internal Veyra employee authentication portal.
 *
 * MECHANISM:
 * 1. Root page (GET /) is a generic corporate placeholder with zero links to the login portal.
 * 2. Login interface is hosted at /portal, discoverable via standard directory wordlists.
 * 3. Protected by hardcoded default credentials: admin / admin123.
 * 4. Login attempts are rate-limited via Redis (or in-memory fallback) to throttle brute-forcing.
 * 5. Upon successful authentication, issues a signed session cookie and reveals the flag.
 * 6. Implements standardized health (GET /healthz) and reset (POST /reset/4) hooks.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load root and local .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const port = parseInt(process.env.CHALLENGE_04_PORT || '3004', 10);
const resetToken = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const sessionSecret = process.env.PORTAL_SESSION_SECRET || 'veyra-portal-secret-key-32b';

export const FLAG = 'ROOT{3mpl0y33_p0rt4l_d3f4ult_cr3ds_881a}';

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
    res.on('finish', () => console.log(JSON.stringify({ level: 'info', service: '04-employee-portal', method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(sessionSecret));

// Optional Redis client for distributed rate limiting
let redisClient: Redis | null = null;
try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });
  redisClient.connect().catch((err) => {
    console.warn('[Challenge-04] Redis connection warning (falling back to memory):', err.message);
    redisClient = null;
  });
} catch {
  redisClient = null;
}

// In-memory fallback rate limiting
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remainingSec: number }> {
  const windowSec = 10;
  const maxAttempts = 5;

  if (redisClient && redisClient.status === 'ready') {
    try {
      const key = `ch04:ratelimit:${ip}`;
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSec);
      }
      const ttl = await redisClient.ttl(key);
      return { allowed: count <= maxAttempts, remainingSec: ttl > 0 ? ttl : windowSec };
    } catch {
      // Fallback to memory
    }
  }

  const now = Date.now();
  const record = memoryRateLimits.get(ip);
  if (!record || now > record.resetAt) {
    memoryRateLimits.set(ip, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remainingSec: windowSec };
  }

  if (record.count >= maxAttempts) {
    const remainingSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingSec };
  }

  record.count += 1;
  return { allowed: true, remainingSec: Math.ceil((record.resetAt - now) / 1000) };
}

// ── 1. Landing Page (No Login Link) ──────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra Cloud Solutions — Internal Network</title>
  <style>
    body { font-family: sans-serif; background: #0f172a; color: #94a3b8; text-align: center; padding: 5rem 1rem; }
    h1 { color: #f8fafc; font-size: 2rem; margin-bottom: 1rem; }
    p { max-width: 600px; margin: 0 auto; line-height: 1.6; }
    .badge { display: inline-block; background: #1e293b; color: #38bdf8; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Veyra Cloud Systems Network Gateway</h1>
  <p>Authorized access only. All sessions, routing flows, and data transitions are monitored and logged.</p>
  <div class="badge">Node: internal-ingress-04a (Active)</div>
</body>
</html>`);
});

// ── 2. Hidden Login Portal Interface (Wordlist Discoverable) ─────────────────
app.get('/portal', (req: Request, res: Response) => {
  if (req.signedCookies.veyra_portal_session === 'admin') {
    return res.redirect('/portal/dashboard');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra Cloud Solutions — Staff Portal</title>
  <style>
    body { font-family: monospace, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131b2e; border: 1px solid #1e293b; padding: 2.5rem; border-radius: 8px; width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: #38bdf8; font-size: 1.4rem; }
    p { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.5rem; }
    input { width: 100%; box-sizing: border-box; background: #080c14; border: 1px solid #334155; padding: 0.75rem; color: #fff; margin-bottom: 1rem; border-radius: 4px; font-family: monospace; }
    button { width: 100%; background: #0284c7; color: #fff; border: none; padding: 0.75rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-family: monospace; }
    button:hover { background: #0369a1; }
    .error { color: #f87171; font-size: 0.85rem; margin-top: 1rem; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Veyra Staff Access</h2>
    <p>Administrative authentication endpoint for internal operations personnel.</p>
    <form method="POST" action="/portal/login">
      <input type="text" name="username" placeholder="Employee ID / Username" required autofocus>
      <input type="password" name="password" placeholder="Passphrase" required>
      <button type="submit">Authenticate</button>
    </form>
  </div>
</body>
</html>`);
});

// ── 3. Login Authentication Endpoint ─────────────────────────────────────────
app.post('/portal/login', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { allowed, remainingSec } = await checkRateLimit(ip);

  if (!allowed) {
    res.setHeader('Retry-After', remainingSec.toString());
    return res.status(429).send(`<!DOCTYPE html>
<html lang="en">
<body style="font-family: monospace; background: #0b0f19; color: #f87171; padding: 3rem; text-align: center;">
  <h2>429 Too Many Requests</h2>
  <p>Rate limit exceeded. Please wait ${remainingSec} seconds before retrying.</p>
</body>
</html>`);
  }

  const { username, password } = req.body;

  // Hardcoded default credentials: admin / admin123
  if (username === 'admin' && password === 'admin123') {
    res.cookie('veyra_portal_session', 'admin', {
      signed: true,
      httpOnly: true,
      maxAge: 3600 * 1000,
    });
    return res.redirect('/portal/dashboard');
  }

  return res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<body style="font-family: monospace; background: #0b0f19; color: #f87171; padding: 3rem; text-align: center;">
  <h2>Authentication Failed</h2>
  <p>Invalid employee ID or password.</p>
  <p><a href="/portal" style="color: #38bdf8;">Return to Login</a></p>
</body>
</html>`);
});

// ── 4. Authenticated Staff Dashboard (Reveals Flag) ──────────────────────────
app.get('/portal/dashboard', (req: Request, res: Response) => {
  if (req.signedCookies.veyra_portal_session !== 'admin') {
    return res.redirect('/portal');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra Staff Portal — Dashboard</title>
  <style>
    body { font-family: monospace, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 3rem; line-height: 1.6; }
    .card { background: #131b2e; border: 1px solid #1e293b; padding: 2rem; border-radius: 8px; max-width: 700px; margin: 0 auto; }
    h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 0.5rem; }
    .flag-box { background: #030712; border: 1px dashed #38bdf8; padding: 1.2rem; color: #38bdf8; font-size: 1.2rem; font-weight: bold; margin: 1.5rem 0; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Veyra Cloud Staff Portal — Welcome, Administrator</h1>
    <p>Administrative system token:</p>
    <div class="flag-box">${FLAG}</div>
    <p><small style="color: #64748b;">Notice: Default administrative credentials MUST be cycled upon onboarding completion.</small></p>
  </div>
</body>
</html>`);
});

// ── 5. Standard Health Probe Hook ────────────────────────────────────────────
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    challenge_id: 4,
    service: 'challenge-04-employee-portal',
    time: new Date().toISOString(),
  });
});

// ── 6. Standard Force-Reset Hook ─────────────────────────────────────────────
app.post('/reset/4', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const expectedBearer = `Bearer ${resetToken}`;

  if (!authHeader || authHeader !== expectedBearer) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid reset bearer token',
    });
  }

  // Clear in-memory and Redis rate limiters
  memoryRateLimits.clear();
  if (redisClient && redisClient.status === 'ready') {
    try {
      const keys = await redisClient.keys('ch04:ratelimit:*');
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch {}
  }

  return res.status(200).json({
    status: 'ok',
    challenge_id: 4,
    reset_at: new Date().toISOString(),
    message: 'Rate limit counters cleared successfully.',
  });
});

export let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`[Challenge-04] Employee Portal running on port ${port}`);
  });
}

export default app;
