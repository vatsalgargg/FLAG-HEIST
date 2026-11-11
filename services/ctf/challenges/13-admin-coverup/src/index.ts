/**
 * ROOT CTF — Challenge 13: The Admin Cover-Up (Final Capstone Challenge)
 *
 * TEACHING OBJECTIVE:
 * Multi-stage server-side request forgery (SSRF) and defense-in-depth access control bypass.
 *
 * THE 5 PROGRESSIVE STAGES:
 * Stage 1: Public "link preview" tool with filter blocking obvious internal IPs, bypassed
 *          via an open redirect hosted on the public service itself.
 * Stage 2: First internal information page (/internal/proc-meta-39) revealing the existence
 *          and route of the secondary service (/internal/relay-auth-72).
 * Stage 3: Second internal page (/internal/relay-auth-72) requiring a short-lived access code
 *          dispatched exclusively out-of-band to the participant's Collab endpoint.
 * Stage 4: Verifying the access code against the second internal page returns an administrative
 *          access key and the final vault route (/internal/core-vault-99).
 * Stage 5: Third internal page (/internal/core-vault-99) protected by an access-key header
 *          check returning the final competition flag.
 *
 * INVARIANTS:
 * - All internal pages are accessible ONLY internally (127.0.0.1/localhost).
 * - Cloud metadata endpoint (169.254.169.254) is blocked at Stage 1 and throughout.
 * - Standard healthz check and two-part reset (POST /reset/13).
 */

import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const port = parseInt(process.env.CHALLENGE_13_PORT || '3013', 10);
const RESET_TOKEN = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';
const COLLAB_URL = process.env.COLLAB_URL || 'http://localhost:8082';

const FINAL_FLAG = 'ROOT{ssrf_ch41n_4dm1n_c0v3rup_99f1}';
const ADMIN_ACCESS_KEY = 'veyra_adm_k3y_99f1a7';

// Short-lived access codes map: Map<code, { createdAt: number }>
const codeSecret = process.env.CHALLENGE_CODE_SECRET || crypto.randomBytes(32).toString('hex');
const CODE_TTL_MS = 5 * 60 * 1000; // 5-minute validity window

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

export function createChallenge13App(): Application {
  const app = express();

  app.use(securityHeadersMiddleware);

  // Pattern B: Per-request ephemeral scratch context
  app.use((req: any, res: Response, next: express.NextFunction) => {
    const runId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    req.requestId = runId;
    next();
  });

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper middleware to restrict internal routes strictly to local requests
  const requireLocalOnly = (req: Request, res: Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    const isLocal =
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      ip.includes('127.0.0.1');

    if (!isLocal) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Route restricted strictly to internal cluster mesh.',
      });
    }
    next();
  };

  // ── 1. Mandatory Health Check Probe ──────────────────────────────────────────
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'challenge-13-admin-coverup',
      time: new Date().toISOString(),
    });
  });

  // ── 2. Standardized Reset Endpoint Hook ──────────────────────────────────────
  app.post('/reset/13', async (req: Request, res: Response) => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/, '') || req.query.token;
    if (!bearer || bearer !== RESET_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid reset token' });
    }

    // Clear active access codes
    // Disposable request containers have no mutable challenge state to clear.

    // Clear collaborator logs for team if specified
    const teamToken = req.body?.team_token;
    try {
      await fetch(`${COLLAB_URL.replace(/\/+$/, '')}/reset/13`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESET_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team_token: teamToken }),
      });
    } catch {
      // Ignore if Collab is temporarily standalone
    }

    return res.status(200).json({
      status: 'ok',
      challenge_id: 13,
      reset_at: new Date().toISOString(),
      message: 'SSRF chain reset and collaborator entries cleared',
    });
  });

  // ── STAGE 1: Public Open Redirect on Public Demo Site ────────────────────────
  /**
   * The intentional single gap in the filter:
   * The public application hosts an open redirect endpoint at /redirect?target=...
   */
  app.get('/redirect', (req: Request, res: Response) => {
    const target = req.query.target;
    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'MissingTarget', message: 'Target URL is required.' });
    }
    // Perform open redirect (HTTP 302)
    return res.redirect(302, target);
  });

  // ── STAGE 1: Public Link Preview Endpoint with Filter ────────────────────────
  app.get(['/preview', '/api/preview'], async (req: Request, res: Response) => {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'MissingUrl', message: 'Query parameter "url" is required.' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'InvalidUrl', message: 'Provided URL could not be parsed.' });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Explicit Filter: Block obvious internal/local addresses and cloud metadata
    const isBlocked =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('127.') ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith('169.254.') || // Explicit cloud metadata block
      parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:';

    // The filter blocks direct internal targets:
    // EXCEPT that URLs targeting the app's own public port/domain or relative redirects pass through!
    const isOwnHost =
      (hostname === 'localhost' || hostname === '127.0.0.1') &&
      parsedUrl.port === String(port) &&
      parsedUrl.pathname === '/redirect';

    if (isBlocked && !isOwnHost) {
      return res.status(403).json({
        error: 'ForbiddenAddress',
        message: 'Security filter violation: Requests to internal network or cloud metadata addresses are prohibited.',
      });
    }

    try {
      // The fetch client follows redirects by default:
      // Following /redirect?target=http://127.0.0.1:3013/internal/... cleanly bypasses the initial hostname check!
      const headers: Record<string, string> = {
        'User-Agent': 'Veyra-LinkPreview-Bot/2.1',
      };
      if (req.headers['x-veyra-access-key']) {
        headers['x-veyra-access-key'] = String(req.headers['x-veyra-access-key']);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const upstreamRes = await fetch(rawUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = upstreamRes.headers.get('content-type') || '';
      let bodyData: any;
      if (contentType.includes('application/json')) {
        bodyData = await upstreamRes.json();
      } else {
        bodyData = await upstreamRes.text();
      }

      return res.status(upstreamRes.status).json({
        status: 'ok',
        target: rawUrl,
        upstreamStatus: upstreamRes.status,
        preview: bodyData,
      });
    } catch (fetchErr: any) {
      return res.status(502).json({
        error: 'FetchError',
        message: `Failed to fetch preview: ${fetchErr.message}`,
      });
    }
  });

  // ── STAGE 2: First Internal Information Page ─────────────────────────────────
  /**
   * Reachable only via Stage 1 gap.
   * Reveals the existence/route of the second internal page (/internal/relay-auth-72).
   */
  app.get('/internal/proc-meta-39', requireLocalOnly, (_req: Request, res: Response) => {
    return res.status(200).json({
      service: 'Veyra Internal Service Mesh Registry',
      node_id: 'mesh-node-49b2',
      registered_services: [
        {
          name: 'Core Auth Relay',
          path: '/internal/relay-auth-72',
          methods: ['GET', 'POST'],
          description: 'Issues temporary authorization access codes via collaborator callback webhook.',
        },
      ],
    });
  });

  // ── STAGE 3: Second Internal Page — Request Code via Collab ──────────────────
  /**
   * Second internal page. Requires a short-lived access code.
   * Dispatches code out-of-band to the participant's Collab endpoint.
   */
  app.all('/internal/relay-auth-72/dispatch-code', requireLocalOnly, async (req: Request, res: Response) => {
    const callbackUrl = (req.body?.callback_url || req.query?.callback_url) as string;

    if (!callbackUrl || typeof callbackUrl !== 'string') {
      return res.status(400).json({
        error: 'MissingCallback',
        message: 'A valid callback_url parameter targeting your collaborator receiver is required.',
      });
    }

    // Generate short-lived random access code
    const payload = `${Date.now()}.${crypto.randomBytes(8).toString('hex')}`;
    const signature = crypto.createHmac('sha256', codeSecret).update(payload).digest('hex');
    const accessCode = `SEC-${payload}.${signature}`;

    // Send access code out-of-band to collaborator endpoint
    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Veyra-Auth-Relay-Internal',
          event: 'CODE_DISPATCH',
          access_code: accessCode,
          expires_in_seconds: 300,
        }),
      });
    } catch (err: any) {
      // Callback attempt logged
    }

    return res.status(200).json({
      status: 'dispatched',
      message: 'Temporary security code dispatched to registered collaborator URL.',
      expires_in: 300,
    });
  });

  // ── STAGE 4: Second Internal Page — Verify Code & Return Secret Key ───────────
  app.all('/internal/relay-auth-72/verify', requireLocalOnly, (req: Request, res: Response) => {
    const code = (req.body?.code || req.query?.code) as string;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'MissingCode', message: 'Security code is required.' });
    }

    const match = /^SEC-(\d+\.[a-f0-9]{16})\.([a-f0-9]{64})$/.exec(code);
    const expected = match ? crypto.createHmac('sha256', codeSecret).update(match[1]).digest('hex') : '';
    const age = match ? Date.now() - Number(match[1].split('.')[0]) : Infinity;
    if (!match || age < 0 || age > CODE_TTL_MS || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(match[2]))) {
      return res.status(401).json({ error: 'InvalidCode', message: 'Security code is invalid or expired.' });
    }

    // Code verified: return administrative configuration and vault endpoint
    return res.status(200).json({
      status: 'authorized',
      message: 'Access granted to internal administrative vault.',
      vault_endpoint: '/internal/core-vault-99',
      required_header: 'X-Veyra-Access-Key',
      access_key: ADMIN_ACCESS_KEY,
    });
  });

  // ── STAGE 5: Third Internal Page — Protected by Access Key Header ─────────────
  app.get('/internal/core-vault-99', requireLocalOnly, (req: Request, res: Response) => {
    const providedKey = req.headers['x-veyra-access-key'] || req.query['key'];

    if (!providedKey || providedKey !== ADMIN_ACCESS_KEY) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing X-Veyra-Access-Key authentication header.',
      });
    }

    // Flag returned!
    return res.status(200).json({
      status: 'success',
      classification: 'TOP SECRET // VEYRA CLOUD INFRASTRUCTURE',
      message: 'Master audit records released.',
      flag: FINAL_FLAG,
      incident: 'ROOT CTF Final Stage Solved',
    });
  });

  return app;
}

export const challenge13App = createChallenge13App();

if (process.env.NODE_ENV !== 'test') {
  challenge13App.listen(port, () => {
    console.log(
      JSON.stringify({
        service: 'challenge-13-admin-coverup',
        port,
        status: 'running',
        health: `http://localhost:${port}/healthz`,
      })
    );
  });
}

export default challenge13App;
