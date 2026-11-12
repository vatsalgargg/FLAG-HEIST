"use client";

import { useCTF } from "@/context/CTFContext";

export function ChallengeCard() {
  const { currentChallenge } = useCTF();
  const ch = currentChallenge;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono" style={{ color: "var(--fg-muted)" }}>
          Challenge {ch.id} of 13 · {ch.points} pts
        </span>
      </div>

      <h2 className="text-2xl font-semibold leading-tight tracking-tight">
        {ch.title}
      </h2>

      <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
        {ch.storyBeat}
      </p>

      <div
        className="rounded-lg p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-medium mb-3" style={{ color: "var(--fg-muted)" }}>
          Intel
        </p>
        <p className="text-sm leading-relaxed">{ch.narrative}</p>
      </div>

      <div>
        <p className="text-xs font-medium mb-3" style={{ color: "var(--fg-muted)" }}>
          Briefing
        </p>
        <p className="text-sm leading-relaxed">{ch.briefing}</p>
      </div>
    </div>
  );
}
