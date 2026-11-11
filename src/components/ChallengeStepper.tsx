"use client";

import { useCTF } from "@/context/CTFContext";
import { challenges } from "@/data/challenges";

export function ChallengeStepper() {
  const { team, currentChallenge, goToChallenge, unlockedIndex } = useCTF();

  return (
    <div className="flex flex-col gap-1">
      {challenges.map((ch, idx) => {
        const isCurrent = ch.id === currentChallenge.id;
        const isSolved = team.solvedChallenges.has(ch.id);
        const isPast = idx < team.currentChallengeIndex;

        return (
          <button
            onClick={() => goToChallenge(idx)}
            disabled={idx > unlockedIndex}
            aria-current={isCurrent ? "step" : undefined}
            key={ch.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{
              background: isCurrent ? "var(--surface)" : "transparent",
              color: isSolved
                ? "var(--success)"
                : isCurrent
                ? "var(--fg)"
                : "var(--fg-muted)",
              opacity: !isPast && !isCurrent ? 0.4 : 1,
            }}
          >
            {/* Status dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: isSolved
                  ? "var(--success)"
                  : isCurrent
                  ? "var(--accent)"
                  : "var(--border)",
              }}
            />
            <span className="truncate">{ch.title}</span>
            <span className="ml-auto font-mono flex-shrink-0" style={{ color: "var(--fg-muted)" }}>
              {ch.points}
            </span>
          </button>
        );
      })}
    </div>
  );
}

