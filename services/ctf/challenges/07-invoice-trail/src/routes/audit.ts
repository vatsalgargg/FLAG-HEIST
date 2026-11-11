/**
 * Challenge 07 & 08 — Audit Memos Route (In-App Clue)
 *
 * Exposes internal audit notes to Priya Nair, including the escalation memo
 * that explicitly references Customer ID 9104 (Apex Sovereign Holdings) and
 * Invoice #1.
 */

import { Router, Request, Response } from 'express';
import { requirePortalAuth } from '../auth';
import { getDatabase } from '../db';

const router = Router();

router.get('/api/audit/memos', requirePortalAuth, (_req: Request, res: Response) => {
  const db = getDatabase();
  const notes = db.prepare(`
    SELECT note_id, title, content, category, author, created_at
    FROM audit_notes
    ORDER BY created_at DESC
  `).all();

  res.status(200).json({
    status: 'success',
    count: notes.length,
    memos: notes,
  });
});

export default router;
