/**
 * ROOT CTF — Out-of-Band Collaborator Logging Service (/collab)
 *
 * Implements Phase H requirements:
 * 1. Internal logging service used by Modules 12 & 13 for indirect outbound observability.
 * 2. Issues unique random identifiers per team.
 * 3. Inbound callback receiver tagged by team token (method, path, headers, query, body, timestamp, source IP).
 * 4. Strict isolation on read endpoint (one team can never read another team's logs).
 * 5. Clear-log endpoint for individual team resets and global admin force-reset contract.
 * 6. Sealed network model: strictly no outbound requests to the internet or internal services.
 * 7. Standard healthz check.
 */

import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const port = parseInt(process.env.COLLAB_PORT || '8082', 10);
const RESET_TOKEN = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';
const MAX_LOGS_PER_TOKEN = 100; // Cap log history per token to prevent memory exhaustion

export interface CollabLogEntry {
  id: string;
  timestamp: string;
  sourceIp: string;
  method: string;
  path: string;
  query: Record<string, any>;
  headers: Record<string, any>;
  body: any;
}

// In-memory partitioned log storage: Map<team_token, CollabLogEntry[]>
const tokenLogs = new Map<string, CollabLogEntry[]>();
const MAX_ACTIVE_TOKENS = 20000;
const validToken = (token: string) => /^clb_[a-f0-9]{16,24}$/.test(token);

export function securityHeadersMiddleware(_req: Request, res: Response, next: express.NextFunction): void {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
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

export function createCollabApp(): Application {
  const app = express();

  app.use(securityHeadersMiddleware);
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => console.log(JSON.stringify({ level: 'info', service: 'collab', method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.text({ limit: '1mb', type: '*/*' }));

  // ── 1. Standard Health Check ─────────────────────────────────────────────────
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'collab',
      time: new Date().toISOString(),
      activeTokens: tokenLogs.size,
    });
  });

  // ── 2. Unique Token Issuance ────────────────────────────────────────────────
  /**
   * POST /collab/token or GET /collab/token
   * Generates a cryptographically random team collaborator token.
   */
  const issueTokenHandler = (_req: Request, res: Response) => {
    if (tokenLogs.size >= MAX_ACTIVE_TOKENS) return res.status(429).json({ message: 'Callback capacity reached.' });
    const rawId = crypto.randomBytes(12).toString('hex');
    const token = `clb_${rawId}`;
    if (!tokenLogs.has(token)) {
      if (tokenLogs.size >= MAX_ACTIVE_TOKENS) return res.status(429).json({ message: 'Callback capacity reached.' });
      tokenLogs.set(token, []);
    }
    return res.status(200).json({
      token,
      callbackUrl: `/c/${token}`,
      logUrl: `/collab/${token}/log`,
    });
  };

  app.post('/collab/token', issueTokenHandler);
  app.get('/collab/token', issueTokenHandler);

  const extractToken = (param: string | string[] | undefined): string | null => {
    if (!param) return null;
    const token = Array.isArray(param) ? param[0] : param;
    return typeof token === 'string' && validToken(token.trim()) ? token.trim() : null;
  };

  // ── 3. Inbound Tagged Request Logging ────────────────────────────────────────
  /**
   * Catches any HTTP verb sent to /c/:token or /c/:token/*
   * Logs full details and appends to the team's private partitioned log.
   */
  const logInboundCallback = (req: Request, res: Response) => {
    const token = extractToken(req.params.token);
    if (!token) {
      return res.status(400).json({ error: 'MissingToken', message: 'Team callback token is required.' });
    }

    const subpath = req.params[0] ? `/${req.params[0]}` : '/';

    // Clone headers, omitting internal proxy headers if any
    const headers: Record<string, any> = { ...req.headers };
    delete headers['connection'];

    const entry: CollabLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sourceIp: req.ip || req.socket.remoteAddress || 'unknown',
      method: req.method,
      path: subpath,
      query: { ...req.query },
      headers,
      body: req.body,
    };

    if (!tokenLogs.has(token)) {
      if (tokenLogs.size >= MAX_ACTIVE_TOKENS) return res.status(429).json({ message: 'Callback capacity reached.' });
      tokenLogs.set(token, []);
    }

    const logs = tokenLogs.get(token)!;
    logs.push(entry);

    // Keep bounded circular buffer to prevent unbounded memory growth under load
    if (logs.length > MAX_LOGS_PER_TOKEN) {
      logs.shift();
    }

    return res.status(200).json({
      status: 'received',
      id: entry.id,
      timestamp: entry.timestamp,
    });
  };

  app.all('/c/:token', logInboundCallback);
  app.all('/c/:token/*', logInboundCallback);
  app.all('/log/:token', logInboundCallback);
  app.all('/log/:token/*', logInboundCallback);

  // ── 4. Private Team Log Retrieval ───────────────────────────────────────────
  /**
   * GET /collab/:token/log (and /collab/:token/entries)
   * Strictly returns ONLY the entries for the provided token.
   * Cross-team log leakage is structurally impossible.
   */
  const readTeamLogs = (req: Request, res: Response) => {
    const token = extractToken(req.params.token);
    if (!token) {
      return res.status(400).json({ error: 'MissingToken', message: 'Token is required' });
    }

    const entries = tokenLogs.get(token) || [];
    return res.status(200).json({
      token,
      count: entries.length,
      entries,
    });
  };

  app.get('/collab/:token/log', readTeamLogs);
  app.get('/collab/:token/entries', readTeamLogs);

  // ── 5. Clear Log Endpoints ──────────────────────────────────────────────────
  /**
   * POST /collab/:token/clear
   * Clears the team's specific log entries.
   */
  app.post('/collab/:token/clear', (req: Request, res: Response) => {
    const token = extractToken(req.params.token);
    if (token && tokenLogs.has(token)) {
      tokenLogs.set(token, []);
    }
    return res.status(200).json({
      status: 'ok',
      message: `Cleared logs for token ${token || 'unknown'}`,
      clearedAt: new Date().toISOString(),
    });
  });

  /**
   * POST /reset/collab (and POST /reset/12, POST /reset/13)
   * Standard administrative force-reset contract.
   * Requires Bearer RESET_TOKEN.
   */
  const adminResetHandler = (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.replace(/^Bearer\s+/, '');
    if (!bearer || bearer !== RESET_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid reset token' });
    }

    const { team_token } = req.body || {};
    if (team_token && typeof team_token === 'string') {
      tokenLogs.delete(team_token);
      return res.status(200).json({
        status: 'ok',
        challenge_id: 'collab',
        reset_at: new Date().toISOString(),
        message: `Cleared logs for team token: ${team_token}`,
      });
    }

    // Clear all if no specific team specified
    tokenLogs.clear();
    return res.status(200).json({
      status: 'ok',
      challenge_id: 'collab',
      reset_at: new Date().toISOString(),
      message: 'All collaborator logs cleared',
    });
  };

  app.post('/reset/collab', adminResetHandler);
  app.post('/reset/12', adminResetHandler);
  app.post('/reset/13', adminResetHandler);

  return app;
}

export const collabApp = createCollabApp();

if (process.env.NODE_ENV !== 'test') {
  collabApp.listen(port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'collab',
        message: `Collaborator logging service active on port ${port}`,
        health: `http://localhost:${port}/healthz`,
      })
    );
  });
}

export default collabApp;
