/**
 * ROOT CTF — Authoritative Results Export CLI Tool
 *
 * Implements Phase N Requirement:
 * "Build a results-export feature producing a final authoritative snapshot
 * (every team's final score, solve timeline, full score history) once the
 * event ends, documented as the official record (more authoritative than
 * the live leaderboard cache)."
 */

import fs from 'fs';
import path from 'path';
import { db, closeDatabase, teams, solves, challenges, scoreLog } from '../db';
import { eq, asc } from 'drizzle-orm';

async function exportOfficialResults(): Promise<void> {
  const line = '='.repeat(80);
  console.log(`\n${line}`);
  console.log('ROOT CTF — OFFICIAL AUTHORITATIVE EVENT RECORD EXPORT');
  console.log(line);

  try {
    console.log('[1/4] Querying ground-truth teams, solves, and score_log from SQLite...');

    const [allTeams, allSolves, allLogs] = await Promise.all([
      db
        .select({
          id: teams.id,
          teamName: teams.teamName,
          teamSize: teams.teamSize,
          memberEmails: teams.memberEmails,
          createdAt: teams.createdAt,
        })
        .from(teams),

      db
        .select({
          id: solves.id,
          teamId: solves.teamId,
          challengeId: solves.challengeId,
          challengeName: challenges.name,
          solvedAt: solves.solvedAt,
        })
        .from(solves)
        .innerJoin(challenges, eq(solves.challengeId, challenges.id))
        .orderBy(asc(solves.solvedAt)),

      db
        .select({
          id: scoreLog.id,
          teamId: scoreLog.teamId,
          delta: scoreLog.delta,
          reason: scoreLog.reason,
          actor: scoreLog.actor,
          createdAt: scoreLog.createdAt,
        })
        .from(scoreLog)
        .orderBy(asc(scoreLog.createdAt)),
    ]);

    console.log(`  ✓ Found ${allTeams.length} registered teams`);
    console.log(`  ✓ Found ${allSolves.length} total verified solves`);
    console.log(`  ✓ Found ${allLogs.length} append-only score ledger transactions`);

    console.log('\n[2/4] Aggregating loss-based derived scores and solve timelines...');
    const solvesByTeam = new Map<string, any[]>();
    for (const s of allSolves) {
      if (!solvesByTeam.has(s.teamId)) solvesByTeam.set(s.teamId, []);
      solvesByTeam.get(s.teamId)!.push({
        challenge_id: s.challengeId,
        challenge_name: s.challengeName,
        solved_at: s.solvedAt.toISOString(),
      });
    }

    const logsByTeam = new Map<string, any[]>();
    for (const l of allLogs) {
      if (!logsByTeam.has(l.teamId)) logsByTeam.set(l.teamId, []);
      logsByTeam.get(l.teamId)!.push({
        id: l.id,
        delta: l.delta,
        reason: l.reason,
        actor: l.actor,
        created_at: l.createdAt.toISOString(),
      });
    }

    const teamRecords = allTeams.map((t) => {
      const teamLogs = logsByTeam.get(t.id) || [];
      const teamSolves = solvesByTeam.get(t.id) || [];

      let scoreDeltaSum = 0;
      let lastActivityAt = t.createdAt.getTime();

      for (const log of teamLogs) {
        scoreDeltaSum += log.delta;
        const logTime = new Date(log.created_at).getTime();
        if (logTime > lastActivityAt) {
          lastActivityAt = logTime;
        }
      }

      const finalScore = 200 + scoreDeltaSum;

      return {
        team_id: t.id,
        team_name: t.teamName,
        team_size: t.teamSize,
        member_emails: t.memberEmails,
        registered_at: t.createdAt.toISOString(),
        final_score: finalScore,
        total_solves: teamSolves.length,
        last_score_change_at: new Date(lastActivityAt).toISOString(),
        solves_timeline: teamSolves,
        score_history: teamLogs,
      };
    });

    // Sort by ground-truth tie-break rules:
    // 1. final_score DESC
    // 2. last_score_change_at ASC (earlier is better)
    // 3. team_name ASC
    teamRecords.sort((a, b) => {
      if (b.final_score !== a.final_score) {
        return b.final_score - a.final_score;
      }
      const timeA = new Date(a.last_score_change_at).getTime();
      const timeB = new Date(b.last_score_change_at).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.team_name.localeCompare(b.team_name);
    });

    // Assign final authoritative rank
    const rankedResults = teamRecords.map((r, idx) => ({
      rank: idx + 1,
      ...r,
    }));

    console.log('\n[3/4] Generating export files (JSON and CSV)...');
    const exportsDir = path.resolve(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(exportsDir, `root-ctf-official-snapshot-${timestamp}.json`);
    const csvPath = path.join(exportsDir, `root-ctf-official-results-${timestamp}.csv`);

    // Write JSON Snapshot
    const snapshotPayload = {
      metadata: {
        exported_at: new Date().toISOString(),
        total_teams: rankedResults.length,
        total_solves: allSolves.length,
        total_score_events: allLogs.length,
        scoring_model: 'Loss-based: Derived as 200 + SUM(score_log.delta)',
        status: 'OFFICIAL_AUTHORITATIVE_EVENT_RECORD',
      },
      results: rankedResults,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(snapshotPayload, null, 2), 'utf-8');

    // Write CSV Summary
    const headers = ['Rank', 'Team Name', 'Team ID', 'Final Score', 'Total Solves', 'Registered At', 'Last Score Change At'];
    const rows = rankedResults.map((r) => [
      r.rank,
      `"${r.team_name.replace(/"/g, '""')}"`,
      r.team_id,
      r.final_score,
      r.total_solves,
      r.registered_at,
      r.last_score_change_at,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    console.log(`  ✓ Authoritative JSON snapshot saved to: ${jsonPath}`);
    console.log(`  ✓ Tabular CSV summary saved to:         ${csvPath}`);

    console.log('\n[4/4] Official Podium Summary (Top 5 Teams):');
    console.log('--------------------------------------------------------------------------------');
    console.log('Rank  Team Name                       Score  Solves  Last Score Change');
    console.log('-------------------------------------------------------------------------');
    for (const team of rankedResults.slice(0, 5)) {
      console.log(
        `#${String(team.rank).padEnd(4)} ${team.team_name.padEnd(30)} ${String(team.final_score).padEnd(6)} ${String(team.total_solves).padEnd(7)} ${team.last_score_change_at}`
      );
    }
    console.log('--------------------------------------------------------------------------------');

    console.log(`\n${line}`);
    console.log('✅ AUTHORITATIVE RESULTS EXPORT COMPLETED SUCCESSFULLY');
    console.log(`${line}\n`);
  } catch (err: any) {
    console.error('\n❌ Export failed:', err.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

if (process.argv[1]?.includes('exportResults')) {
  exportOfficialResults();
}

export default exportOfficialResults;
