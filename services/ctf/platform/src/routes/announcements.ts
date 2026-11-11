/**
 * Public Announcements Route (/api/announcements and /announcements)
 *
 * Implements public organiser-to-participant broadcast channel.
 *
 * PERFORMANCE DESIGN:
 * - Aggressively cached in Redis ('announcements:active') with a 10s TTL.
 * - Under 20,000 participant polling concurrency, origin database receives at most
 *   1 query every 10 seconds.
 */

import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, announcements } from '../db';
import { getCachedJson, setCachedJson } from '../cache';

export const announcementsRouter = Router();

const ANNOUNCEMENTS_CACHE_KEY = 'announcements:active';
const ANNOUNCEMENTS_CACHE_TTL = 10; // 10 seconds

export async function getActiveAnnouncementsList() {
  const cached = await getCachedJson<any[]>(ANNOUNCEMENTS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const rows = await db
    .select({
      id: announcements.id,
      message: announcements.message,
      severity: announcements.severity,
      created_at: announcements.createdAt,
      created_by: announcements.createdBy,
      is_active: announcements.isActive,
    })
    .from(announcements)
    .where(eq(announcements.isActive, true))
    .orderBy(desc(announcements.createdAt));

  const formatted = rows.map((r) => ({
    id: r.id,
    message: r.message,
    severity: r.severity,
    created_at: r.created_at.toISOString(),
    created_by: r.created_by,
    is_active: r.is_active,
  }));

  await setCachedJson(ANNOUNCEMENTS_CACHE_KEY, formatted, ANNOUNCEMENTS_CACHE_TTL);
  return formatted;
}

/**
 * GET / (or /api/announcements)
 * Returns all currently active announcements, newest first.
 */
announcementsRouter.get('/', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=5');

  try {
    const list = await getActiveAnnouncementsList();
    return res.status(200).json(list);
  } catch (err: any) {
    console.error('[Announcements] Error fetching active announcements:', err.message);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve active announcements.',
    });
  }
});
