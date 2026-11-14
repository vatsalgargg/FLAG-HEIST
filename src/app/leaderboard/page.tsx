import Link from "next/link";
import { PlatformShell } from "@/components/PlatformShell";
import {
  finalLeaderboard,
  TOTAL_TASKS,
  type FinalLeaderboardEntry,
} from "@/data/leaderboard";

function isTied(a: FinalLeaderboardEntry, b: FinalLeaderboardEntry) {
  return (
    !a.disqualified &&
    !b.disqualified &&
    a.finalScore === b.finalScore &&
    a.roomScore === b.roomScore &&
    a.tasksSolved === b.tasksSolved &&
    a.hintsUsed === b.hintsUsed
  );
}

function getRanks(entries: FinalLeaderboardEntry[]) {
  const ranks: Array<number | "DQ"> = [];
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i].disqualified) {
      ranks.push("DQ");
    } else if (i > 0 && isTied(entries[i], entries[i - 1])) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

export default function LeaderboardPage() {
  const ranks = getRanks(finalLeaderboard);
  const winner = finalLeaderboard.find((e) => !e.disqualified);

  return (
    <PlatformShell title="Final Leaderboard">
      {winner && (
        <div
          className="arena-panel"
          style={{ borderColor: "var(--accent)" }}
        >
          <div
            className="text-xs uppercase tracking-wider mb-1"
            style={{ color: "#f07878" }}
          >
            Winner • Rank #1
          </div>
          <div className="text-xl font-semibold mb-1">{winner.team}</div>
          <div className="text-2xl font-bold tabular-nums mb-1">
            {winner.finalScore}{" "}
            <span
              className="text-sm font-normal"
              style={{ color: "var(--fg-muted)" }}
            >
              pts
            </span>
          </div>
          <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
            {winner.roomScore} room − {winner.hintDeduction} hints (
            {winner.tasksSolved}/{TOTAL_TASKS} tasks)
          </div>
        </div>
      )}

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
                <tr
                  key={entry.team}
                  style={entry.disqualified ? { opacity: 0.7 } : undefined}
                >
                  <td className="number">
                    {entry.disqualified ? (
                      <span
                        className="text-xs font-semibold uppercase"
                        style={{ color: "#f07878" }}
                      >
                        DQ
                      </span>
                    ) : (
                      ranks[index]
                    )}
                  </td>
                  <td style={{ fontWeight: index < 3 && !entry.disqualified ? 600 : 400 }}>
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
                    {entry.disqualified ? (
                      <span
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "#f07878" }}
                      >
                        Disqualified
                      </span>
                    ) : (
                      entry.finalScore
                    )}
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
