"use client";

import { useCTF } from "@/context/CTFContext";

export function ProgressBar() {
  const { team, totalChallenges, solvedCount } = useCTF();
  const pct = (solvedCount / totalChallenges) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--fg-muted)" }}>
        <span>Progress: {solvedCount}/{totalChallenges} solved</span>
        <span className="font-mono">{team.score} pts</span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}

