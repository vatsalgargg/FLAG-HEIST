"use client";

import { useCTF } from "@/context/CTFContext";

export function ChallengeNav() {
  const { goToNext, goToPrev, canGoNext, canGoPrev, index, totalChallenges } =
    useCTF();

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={goToPrev}
        disabled={!canGoPrev}
        className="flex items-center gap-2 text-sm cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-25 disabled:cursor-not-allowed"
        style={{ color: "var(--fg-muted)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 4l-4 4 4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Previous
      </button>

      <span className="text-sm font-mono" style={{ color: "var(--fg-muted)" }}>
        {index + 1} / {totalChallenges}
      </span>

      <button
        onClick={goToNext}
        disabled={!canGoNext}
        className="flex items-center gap-2 text-sm cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-25 disabled:cursor-not-allowed"
        style={{ color: canGoNext ? "var(--accent)" : "var(--fg-muted)" }}
      >
        Next
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
