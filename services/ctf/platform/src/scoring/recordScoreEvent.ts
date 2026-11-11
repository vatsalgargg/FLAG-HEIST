import { db, scoreLog } from '../db';
import { rebuildLeaderboardCache } from '../cache/leaderboard';

// SQLite transactions must finish their ledger writes before publishing a score.
export function appendScoreEvent(
  teamId: string,
  delta: number,
  reason: string,
  actor = 'system',
  executor: Pick<typeof db, 'insert'> = db,
) {
  return executor.insert(scoreLog).values({ teamId, delta, reason, actor, createdAt: new Date() })
    .returning().get();
}

export async function recordScoreEvent(teamId: string, delta: number, reason: string, actor = 'system') {
  const record = appendScoreEvent(teamId, delta, reason, actor);
  await rebuildLeaderboardCache().catch(err => console.warn('[ScoreEvent] Cache refresh failed:', err.message));
  return record;
}
