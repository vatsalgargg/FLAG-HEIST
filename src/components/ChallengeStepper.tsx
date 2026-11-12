"use client";

import { useCTF } from "@/context/CTFContext";
import { challenges } from "@/data/challenges";

export function ChallengeStepper() {
  const { currentChallenge, goToChallenge } = useCTF();

  return (
    <div className="flex flex-col gap-1">
      {challenges.map((ch, idx) => {
        const isCurrent = ch.id === currentChallenge.id;

        return (
          <button
            onClick={() => goToChallenge(idx)}
            aria-current={isCurrent ? "step" : undefined}
            key={ch.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{
              background: isCurrent ? "var(--surface)" : "transparent",
              color: isCurrent ? "var(--fg)" : "var(--fg-muted)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: isCurrent ? "var(--accent)" : "var(--border)",
              }}
            />
            <span
              className="font-mono flex-shrink-0"
              style={{ color: "var(--fg-muted)" }}
            >
              {String(ch.id).padStart(2, "0")}
            </span>
            <span className="truncate">{ch.title}</span>
            <span
              className="ml-auto font-mono flex-shrink-0"
              style={{ color: "var(--fg-muted)" }}
            >
              {ch.points}
            </span>
          </button>
        );
      })}
    </div>
  );
}
