/**
 * ROOT CTF — Challenge 10: The Config Backup (/challenges/10-config-backup)
 *
 * TEACHING OBJECTIVE:
 * Teaches path traversal vulnerability arising from naive literal string filtering
 * evaluated prior to URI component decoding.
 *
 * SPECIFICATION INVARIANTS:
 * 1. Filter explicitly blocks the literal substring "../" without canonical normalization.
 * 2. URL double encoding (%252e%252e%252f) cleanly bypasses the filter because Express
 *    automatically parses %25 to % (yielding %2e%2e%2f, which lacks literal "../"), and
 *    the application subsequently decodes the URI component before resolving the path.
 * 3. Both "blocked by filter" and "file not found" return IDENTICAL generic responses
 *    (HTTP 404 with identical JSON payload) to prevent status/message discrepancy enumeration.
 * 4. Container deployment uses a read-only root filesystem and no outbound network access.
 * 5. GET /healthz and POST /reset/10 standard reset contract.
 */

import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const port = parseInt(process.env.CHALLENGE_10_PORT || '3010', 10);
const RESET_TOKEN = process.env.RESET_TOKEN || 'dev-reset-bearer-token-12345';

const BACKUP_DIR = path.resolve(__dirname, '../data/backups');
const GENERIC_NOT_FOUND_RESPONSE = {
  error: 'NotFound',
  message: 'The requested backup artifact does not exist or access is restricted.',
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

export function createChallenge10App(): Application {
  const app = express();

  app.use(securityHeadersMiddleware);

  // Pattern B: Per-request ephemeral scratch sandbox
  app.use((req: any, res: Response, next: express.NextFunction) => {
    const runId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const reqScratch = path.join('/tmp', `run_${runId}`);
    try {
      fs.mkdirSync(reqScratch, { recursive: true });
      req.scratchDir = reqScratch;
    } catch {
      // ignore
    }
    res.on('finish', () => {
      try {
        if (req.scratchDir && fs.existsSync(req.scratchDir)) {
          fs.rmSync(req.scratchDir, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
    });
    next();
  });

  app.use(cors());
  app.use(express.json());

  // ── 1. Mandatory Health Check Probe ──────────────────────────────────────────
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'challenge-10-config-backup',
      time: new Date().toISOString(),
    });
  });

  // ── 2. Standardized Reset Endpoint Hook ──────────────────────────────────────
  app.post('/reset/10', (req: Request, res: Response) => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/, '') || req.query.token;
    if (!bearer || bearer !== RESET_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid reset token' });
    }
    return res.status(200).json({
      status: 'ok',
      challenge_id: 10,
      reset_at: new Date().toISOString(),
      message: 'Config backup sandbox verified clean',
    });
  });

  // ── 3. Public File Directory Listing ─────────────────────────────────────────
  app.get(['/', '/api/files'], (_req: Request, res: Response) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR).map((filename) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, filename));
        return {
          filename,
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          downloadUrl: `/api/download?file=${encodeURIComponent(filename)}`,
        };
      });

      return res.status(200).json({
        service: 'Veyra Cloud Backup Gateway',
        version: 'v3.1.2',
        availableBackups: files,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'InternalError', message: 'Failed to inspect backup repository' });
    }
  });

  // ── 4. File Download Feature (Vulnerable to Pre-Decode Literal Filter) ─────────
  const downloadHandler = (req: Request, res: Response) => {
    const rawFileParam = req.query.file;

    if (!rawFileParam || typeof rawFileParam !== 'string') {
      return res.status(404).json(GENERIC_NOT_FOUND_RESPONSE);
    }

    // DELIBERATE TEACHING GAP:
    // The filter naively checks for the literal substring "../" on the raw input string
    // WITHOUT normalizing the path or resolving relative segments first.
    if (rawFileParam.includes('../')) {
      // SECURITY INVARIANT: Return identical generic 404 so filtering cannot be differentiated from missing file
      return res.status(404).json(GENERIC_NOT_FOUND_RESPONSE);
    }

    try {
      // Flawed architecture: The application decodes the filename AFTER applying the blacklist
      const decodedFilename = decodeURIComponent(rawFileParam);

      // Resolve file path relative to the backup directory
      const targetFilePath = path.resolve(BACKUP_DIR, decodedFilename);

      if (!fs.existsSync(targetFilePath) || !fs.statSync(targetFilePath).isFile()) {
        return res.status(404).json(GENERIC_NOT_FOUND_RESPONSE);
      }

      const fileContent = fs.readFileSync(targetFilePath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(fileContent);
    } catch {
      return res.status(404).json(GENERIC_NOT_FOUND_RESPONSE);
    }
  };

  app.get('/api/download', downloadHandler);
  app.get('/download', downloadHandler);

  return app;
}

export const challenge10App = createChallenge10App();

if (process.env.NODE_ENV !== 'test') {
  challenge10App.listen(port, () => {
    console.log(
      JSON.stringify({
        service: 'challenge-10-config-backup',
        port,
        status: 'running',
        health: `http://localhost:${port}/healthz`,
      })
    );
  });
}

export default challenge10App;
