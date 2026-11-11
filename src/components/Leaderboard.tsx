"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
type Entry = {
  rank: number;
  team_name: string;
  score: number;
  last_score_change_at: string;
};
export function Leaderboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [rows, status] = await Promise.all([
          api<Entry[]>("/leaderboard"),
          api<{ frozen: boolean }>("/leaderboard/status"),
        ]);
        if (active) {
          setEntries(rows);
          setFrozen(status.frozen);
          setLoaded(true);
          setError("");
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Unable to load leaderboard.",
          );
      }
    };
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <>
      <p className="arena-muted">
        {frozen
          ? "Scoreboard frozen. Teams can continue solving; final standings will be revealed by the organisers."
          : "Live standings · refreshes every 10 seconds"}
      </p>
      <p className="arena-muted">
        Teams start at 200 points. Revealed hints deduct points immediately.
        Ties use the time a team reached its current score.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="arena-table">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th className="number">Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr key={row.team_name}>
                <td>{row.rank}</td>
                <td>{row.team_name}</td>
                <td className="number">{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!entries.length && (
        <p>
          {loaded
            ? "No registered teams yet."
            : error
              ? "Standings unavailable."
              : "Loading standings…"}
        </p>
      )}
    </>
  );
}
