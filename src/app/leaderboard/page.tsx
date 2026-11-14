import Link from "next/link";
import { PlatformShell } from "@/components/PlatformShell";
import {
  finalLeaderboard,
  LEADERBOARD_LOCKED_NOTE,
  TOTAL_TASKS,
  type FinalLeaderboardEntry,
} from "@/data/leaderboard";

function isTied(a: FinalLeaderboardEntry, b: FinalLeaderboardEntry) {
  return (
    a.finalScore === b.finalScore &&
    a.roomScore === b.roomScore &&
    a.tasksSolved === b.tasksSolved &&
    a.hintsUsed === b.hintsUsed
  );
}

function getRanks(entries: FinalLeaderboardEntry[]) {
  const ranks: number[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    if (i > 0 && isTied(entries[i], entries[i - 1])) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

export default function LeaderboardPage() {
  const ranks = getRanks(finalLeaderboard);
  const podium = finalLeaderboard.slice(0, 3);

  return (
    <PlatformShell title="Final Leaderboard">
      <div
        className="arena-panel"
        style={{ borderColor: "var(--accent)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <span
            className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded"
            style={{
              background: "rgba(224, 64, 64, 0.16)",
              color: "#f07878",
              border: "1px solid rgba(224, 64, 64, 0.4)",
            }}
          >
            Final Standings • Locked
          </span>
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            {finalLeaderboard.length} teams • {TOTAL_TASKS} tasks
          </span>
        </div>
        <p className="arena-muted" style={{ marginBottom: 0 }}>
          {LEADERBOARD_LOCKED_NOTE}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {podium.map((entry, idx) => (
          <div
            key={entry.team}
            className="arena-panel"
            style={{
              marginBottom: 0,
              borderColor: idx === 0 ? "var(--accent)" : "var(--border)",
            }}
          >
            <div
              className="text-xs uppercase tracking-wider mb-1"
              style={{ color: idx === 0 ? "#f07878" : "var(--fg-muted)" }}
            >
              Rank #{ranks[idx]}
            </div>
            <div className="text-lg font-semibold mb-2">{entry.team}</div>
            <div className="text-2xl font-bold tabular-nums mb-1">
              {entry.finalScore}{" "}
              <span
                className="text-sm font-normal"
                style={{ color: "var(--fg-muted)" }}
              >
                pts
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
              {entry.roomScore} room − {entry.hintDeduction} hints (
              {entry.tasksSolved}/{TOTAL_TASKS} tasks)
            </div>
          </div>
        ))}
      </div>

      <div className="arena-panel">
        <div className="arena-table" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th className="number">#</th>
                <th>Team</th>
                <th className="number">Tasks</th>
                <th className="number">Room score</th>
                <th className="number">Hints</th>
                <th className="number">Deduction</th>
                <th className="number">Final score</th>
              </tr>
            </thead>
            <tbody>
              {finalLeaderboard.map((entry, index) => (
                <tr key={entry.team}>
                  <td className="number">{ranks[index]}</td>
                  <td style={{ fontWeight: index < 3 ? 600 : 400 }}>
                    {entry.team}
                  </td>
                  <td className="number">
                    {entry.tasksSolved}/{TOTAL_TASKS}
                  </td>
                  <td className="number">{entry.roomScore}</td>
                  <td className="number">{entry.hintsUsed}</td>
                  <td
                    className="number"
                    style={{
                      color:
                        entry.hintDeduction > 0
                          ? "#f07878"
                          : "var(--fg-muted)",
                    }}
                  >
                    {entry.hintDeduction > 0 ? `−${entry.hintDeduction}` : "0"}
                  </td>
                  <td className="number" style={{ fontWeight: 600 }}>
                    {entry.finalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="arena-panel">
        <p className="arena-muted">
          The Flag Heist competition has concluded and this leaderboard is
          final.
        </p>
        <p>
          <Link href="/arena">Back to the challenges</Link>
        </p>
      </div>
    </PlatformShell>
  );
}
