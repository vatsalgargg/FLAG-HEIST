/**
 * ROOT CTF — Challenge 12: The Diagnostics Backdoor (/challenges/12-diagnostics-backdoor)
 *
 * TEACHING OBJECTIVE:
 * Teaches indirect verification of blind command execution.
 *
 * SPECIFICATION INVARIANTS:
 * 1. The diagnostic endpoint accepts a target hostname or IP address to ping/probe.
 * 2. Unsanitized input is incorporated into an underlying shell execution call.
 * 3. The HTTP response is 100% IDENTICAL regardless of input, success, failure, or timeout.
 *    No command stdout/stderr is ever returned in the HTTP response.
 * 4. The participant verifies command execution indirectly by causing the target container
 *    to make an outbound request to their private team callback endpoint in the Collab service.
 * 5. Outbound network destination is limited exclusively to the Collaborator service;
 *    cloud provider internal metadata address (169.254.169.254) is blocked/unreachable.
 * 6. Two-part reset hook (POST /reset/12): Wipes local scratch storage AND invokes Collab reset
 *    to clear the team's logged interactions.
 * 7. GET /healthz and POST /reset/12.
 */

import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const port = parseInt(process.env.CHALLENGE_12_PORT || '3012', 10);
const RESET_TOKEN = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';
const COLLAB_URL = process.env.COLLAB_URL || 'http://localhost:8082';

const SCRATCH_DIR = path.resolve(__dirname, '../data/scratch');
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
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

// Invariant 3: Constant generic response structure
const IDENTICAL_STATUS_RESPONSE = {
  status: 'completed',
  message: 'Diagnostic probe dispatched to target system',
};

export function createChallenge12App(): Application {
  const app = express();

  app.use(securityHeadersMiddleware);
  app.use(cors());
  app.use(express.json());

  // ── 1. Mandatory Health Check Probe ──────────────────────────────────────────
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'challenge-12-diagnostics-backdoor',
      time: new Date().toISOString(),
    });
  });

  // ── 2. Two-Part Reset Hook (POST /reset/12) ──────────────────────────────────
  app.post('/reset/12', async (req: Request, res: Response) => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/, '') || req.query.token;
    if (!bearer || bearer !== RESET_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid reset token' });
    }

    try {
      // Part 1: Wipe and recreate local scratch directory
      if (fs.existsSync(SCRATCH_DIR)) {
        const files = fs.readdirSync(SCRATCH_DIR);
        for (const file of files) {
          try {
            fs.rmSync(path.join(SCRATCH_DIR, file), { recursive: true, force: true });
          } catch {
            // Ignore ephemeral lock errors
          }
        }
      }

      // Part 2: Discard team entries in Collaborator service
      const teamToken = req.body?.team_token;
      try {
        await fetch(`${COLLAB_URL.replace(/\/+$/, '')}/reset/12`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESET_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ team_token: teamToken }),
        });
      } catch (collabErr: any) {
        // Collab may be temporarily unreachable during standalone testing
      }

      return res.status(200).json({
        status: 'ok',
        challenge_id: 12,
        reset_at: new Date().toISOString(),
        message: 'Diagnostics sandbox wiped clean and collaborator entries cleared',
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'ResetFailure', message: err.message });
    }
  });

  // ── 3. Diagnostic Probe Endpoint (Blind Execution) ───────────────────────────
  const runDiagnosticProbe = (req: Request, res: Response) => {
    const { target } = req.body || {};

    if (!target || typeof target !== 'string') {
      return res.status(200).json({
        ...IDENTICAL_STATUS_RESPONSE,
        timestamp: new Date().toISOString(),
      });
    }

    // DELIBERATE TEACHING GAP:
    // The target parameter is concatenated directly into a shell command string.
    // Command output is redirected to null. The participant receives no stdout.
    // They must verify execution indirectly by exfiltrating data to their Collab token URL.
    const sanitizedCommand = `ping -c 1 -W 1 ${target} > /dev/null 2>&1`;

    // Pattern B: Per-request isolated scratch directory
    const runId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const reqScratch = path.join(SCRATCH_DIR, `run_${runId}`);
    try {
      fs.mkdirSync(reqScratch, { recursive: true });
    } catch {
      // fallback
    }

    exec(sanitizedCommand, {
      timeout: 3000,
      cwd: fs.existsSync(reqScratch) ? reqScratch : SCRATCH_DIR,
      env: {
        ...process.env,
        SCRATCH_DIR: reqScratch,
        CONFIG_PATH: path.resolve(__dirname, '../data/diagnostics.conf'),
      },
    }, () => {
      // Pattern B cleanup: remove ephemeral per-request scratch directory after command finishes
      try {
        if (reqScratch !== SCRATCH_DIR && fs.existsSync(reqScratch)) {
          fs.rmSync(reqScratch, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
    });

    // Immediate constant-time response:
    return res.status(200).json({
      ...IDENTICAL_STATUS_RESPONSE,
      timestamp: new Date().toISOString(),
    });
  };

  app.post('/api/diagnostics/check', runDiagnosticProbe);
  app.post('/check', runDiagnosticProbe);

  return app;
}

export const challenge12App = createChallenge12App();

if (process.env.NODE_ENV !== 'test') {
  challenge12App.listen(port, () => {
    console.log(
      JSON.stringify({
        service: 'challenge-12-diagnostics-backdoor',
        port,
        status: 'running',
        health: `http://localhost:${port}/healthz`,
      })
    );
  });
}

export default challenge12App;
