/**
 * Challenge 05 — Who Is Ethan Cole?
 *
 * Microservice implementing the Veyra corporate staff directory search.
 *
 * MECHANISM:
 * 1. Hosts a corporate personnel directory search endpoint.
 * 2. Normal queries perform an exact-name lookup against public employee records.
 * 3. Deliberate string parser bug: an unescaped trailing double quote (e.g. `Ethan"`)
 *    breaks the string-delimiter parser state, falling through to an unindexed shadow
 *    diagnostic record containing an MD5 hash of Ethan's recovery passphrase.
 * 4. Cracking the short MD5 hash yields the plaintext flag: ROOT{autumn2026}.
 * 5. Implements GET /healthz and POST /reset/5.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const port = parseInt(process.env.CHALLENGE_05_PORT || '3005', 10);
const resetToken = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';

export const FLAG_PLAINTEXT = 'autumn2026';
export const FLAG = 'ROOT{autumn2026}';
export const CRACKABLE_MD5 = '5a2e5c8387cc3ee881d00b6731836e5c'; // MD5 of "autumn2026"

interface EmployeeRecord {
  id: string;
  name: string;
  department: string;
  title: string;
  email: string;
  notes?: string;
  isInternal?: boolean;
}

const PUBLIC_DIRECTORY: EmployeeRecord[] = [
  {
    id: 'EMP-1042',
    name: 'Sarah Chen',
    department: 'Core Infrastructure',
    title: 'Staff Reliability Engineer',
    email: 'sarah.chen@veyra.internal',
  },
  {
    id: 'EMP-1088',
    name: 'Marcus Vance',
    department: 'Platform Mesh',
    title: 'Systems Architect',
    email: 'marcus.vance@veyra.internal',
  },
  {
    id: 'EMP-1104',
    name: 'Ethan Cole',
    department: 'Cloud Ingress & Security Operations',
    title: 'Lead SRE & Ingress Architect',
    email: 'ethan.cole@veyra.internal',
    notes: 'Primary incident responder for us-east staging environment.',
  },
  {
    id: 'EMP-1149',
    name: 'Elena Rostova',
    department: 'Regulatory Compliance',
    title: 'Senior Audit Analyst',
    email: 'elena.rostova@veyra.internal',
  },
  {
    id: 'EMP-1201',
    name: 'David Kim',
    department: 'Edge Compute Fabric',
    title: 'Director of Distributed Systems',
    email: 'david.kim@veyra.internal',
  },
];

// Unindexed diagnostic record surfaced only when the exact query string delimiter breaks
const SHADOW_AUDIT_RECORD: EmployeeRecord = {
  id: 'AUDIT-SEC-9921',
  name: 'CONFIDENTIAL // INCIDENT INVESTIGATION LOG',
  department: 'Security Forensics & Incident Response',
  title: 'Ethan Cole Account Forensics Snapshot',
  email: 'security-incident-response@veyra.internal',
  notes: `[EVIDENCE RECORD #482] Decommissioned ingress operator recovery token hash: ${CRACKABLE_MD5}. Notice: Submit recovered plaintext token in ROOT{<plaintext>} format.`,
  isInternal: true,
};

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
    res.on('finish', () => console.log(JSON.stringify({ level: 'info', service: '05-who-is-ethan-cole', method: req.method, status: res.statusCode, durationMs: Date.now() - started })));
    next();
  });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Executes directory search with deliberate delimiter matching vulnerability.
 */
function searchDirectory(rawQuery: string): EmployeeRecord[] {
  const q = rawQuery.trim();
  if (!q) return [];

  // Deliberate matching flaw: an unescaped trailing double quote causes parser syntax imbalance,
  // falling through to the unindexed shadow audit ledger.
  if (q.endsWith('"') && !q.endsWith('\\"')) {
    return [SHADOW_AUDIT_RECORD];
  }

  // Normal exact match lookup across public records
  return PUBLIC_DIRECTORY.filter((emp) => emp.name.toLowerCase() === q.toLowerCase());
}

// ── 1. Web Search Interface ──────────────────────────────────────────────────
app.get('/', (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const results = query ? searchDirectory(query) : [];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veyra Cloud Solutions — Staff Directory</title>
  <style>
    body { font-family: monospace, sans-serif; background: #0c101a; color: #f1f5f9; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }
    form { display: flex; gap: 10px; margin-bottom: 2rem; }
    input[type="text"] { flex-grow: 1; background: #131b2e; border: 1px solid #334155; padding: 0.75rem; color: #fff; border-radius: 4px; font-family: monospace; }
    button { background: #0284c7; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-family: monospace; }
    button:hover { background: #0369a1; }
    .card { background: #131b2e; border: 1px solid #1e293b; padding: 1.5rem; border-radius: 6px; margin-bottom: 1rem; }
    .card h3 { margin-top: 0; color: #f8fafc; font-size: 1.1rem; }
    .badge { display: inline-block; background: #0369a1; color: #fff; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 3px; }
    .badge-internal { background: #991b1b; }
    .notes { margin-top: 1rem; padding: 0.75rem; background: #080c14; border-left: 3px solid #38bdf8; font-size: 0.85rem; color: #cbd5e1; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Veyra Corporate Personnel Directory</h1>
  <p>Search active staff profiles by exact full name (e.g., "Sarah Chen", "Ethan Cole").</p>

  <form method="GET" action="/">
    <input type="text" name="q" value="${query.replace(/"/g, '&quot;')}" placeholder="Enter exact employee name..." autofocus>
    <button type="submit">Search Records</button>
  </form>

  <div id="results">
    ${query ? (results.length > 0 ? results.map(r => `
      <div class="card">
        <span class="badge ${r.isInternal ? 'badge-internal' : ''}">${r.id}</span>
        <h3>${r.name}</h3>
        <p><strong>Department:</strong> ${r.department}<br>
           <strong>Title:</strong> ${r.title}<br>
           <strong>Contact:</strong> ${r.email}</p>
        ${r.notes ? `<div class="notes">${r.notes}</div>` : ''}
      </div>
    `).join('') : '<p style="color: #64748b;">No employee found matching exact name query.</p>') : ''}
  </div>
</body>
</html>`);
});

// ── 2. JSON API Search Endpoint ──────────────────────────────────────────────
app.get('/search', (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const results = searchDirectory(query);
  return res.status(200).json({ query, count: results.length, results });
});

app.post('/api/search', (req: Request, res: Response) => {
  const query = typeof req.body.query === 'string' ? req.body.query : '';
  const results = searchDirectory(query);
  return res.status(200).json({ query, count: results.length, results });
});

// ── 3. Health Probe Hook ─────────────────────────────────────────────────────
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    challenge_id: 5,
    service: 'challenge-05-who-is-ethan-cole',
    time: new Date().toISOString(),
  });
});

// ── 4. Standard Force-Reset Hook ─────────────────────────────────────────────
app.post('/reset/5', (req: Request, res: Response) => {
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
    challenge_id: 5,
    reset_at: new Date().toISOString(),
    message: 'Reset acknowledged. Static directory data refreshed.',
  });
});

export let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`[Challenge-05] Personnel Directory running on port ${port}`);
  });
}

export default app;
