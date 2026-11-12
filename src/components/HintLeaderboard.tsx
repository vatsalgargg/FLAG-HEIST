"use client";

import { useEffect, useState } from "react";
import type { HintTotalsResponse } from "@/data/hints";

export function HintLeaderboard() {
  const [data, setData] = useState<HintTotalsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/hints", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load hint totals.");
        const json = (await response.json()) as HintTotalsResponse;
        if (active) {
          setData(json);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load hint totals.",
          );
        }
      }
    }

    load();
    const timer = window.setInterval(load, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="arena-panel">
      <p className="arena-muted">
        Hint deductions are tracked on this site. Scores still come from the
        TryHackMe room.
      </p>
      {error && (
        <p role="alert" className="arena-muted">
          {error}
        </p>
      )}
      {!data && !error && <p className="arena-muted">Loading hint totals…</p>}
      {data && (
        <>
          <div className="arena-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th className="number">Hints used</th>
                  <th className="number">Points deducted</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((team, index) => (
                  <tr key={team.team}>
                    <td className="number">{index + 1}</td>
                    <td>{team.team}</td>
                    <td className="number">{team.hints}</td>
                    <td className="number">−{team.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="arena-muted">
            Updated {new Date(data.updatedAt).toLocaleTimeString()}. Refreshes
            every 15 seconds.
          </p>
        </>
      )}
    </div>
  );
}
