"use client";

import { useCTF } from "@/context/CTFContext";

export function ProgressBar() {
  const { index, totalChallenges, totalHints, totalDeducted } = useCTF();
  const pct = ((index + 1) / totalChallenges) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: "var(--fg-muted)" }}
      >
        <span>
          Challenge {index + 1} of {totalChallenges}
        </span>
        <span className="font-mono">
          {totalHints} hint{totalHints === 1 ? "" : "s"} · −{totalDeducted} pts
        </span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}
