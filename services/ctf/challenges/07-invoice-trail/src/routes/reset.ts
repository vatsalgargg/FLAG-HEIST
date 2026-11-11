/**
 * Challenge 07 & 08 — Standardized Healthz and Reset Contract
 *
 * ARCHITECTURAL SPECIFICATION:
 * ==============================================================================
 * A single shared application serves both challenges 7 and 8.
 * It provides two distinct reset endpoints adhering to the standard contract:
 *   POST /reset/7 -> re-seeds the customers and invoices ledger
 *   POST /reset/8 -> re-seeds operational configuration state
 *
 * Both require Authorization: Bearer <RESET_TOKEN>.
 * ==============================================================================
 */

import { Router, Request, Response } from 'express';
import { getDatabase, resetChallenge07, resetChallenge08 } from '../db';

const router = Router();

// Standard Health Probe
router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'veyra-shared-portal',
    challenges: [7, 8],
    time: new Date().toISOString(),
  });
});

// Standard Reset for Challenge 07
router.post('/reset/7', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') || (req.query.token as string);
  const expectedToken = process.env.RESET_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing reset token' });
    return;
  }

  const db = getDatabase();
  resetChallenge07(db);

  res.status(200).json({
    status: 'ok',
    challenge_id: 7,
    message: 'Challenge 07 (The Invoice Trail) database ledger reset successfully',
    time: new Date().toISOString(),
  });
});

// Standard Reset for Challenge 08
router.post('/reset/8', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') || (req.query.token as string);
  const expectedToken = process.env.RESET_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing reset token' });
    return;
  }

  const db = getDatabase();
  resetChallenge08(db);

  res.status(200).json({
    status: 'ok',
    challenge_id: 8,
    message: 'Challenge 08 (The Internal Dashboard) operational services reset successfully',
    time: new Date().toISOString(),
  });
});

export default router;
