"use client";

import { useState } from "react";
import { useCTF } from "@/context/CTFContext";

interface HintSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function HintSidebar({ open, onClose }: HintSidebarProps) {
  const { currentChallenge, revealedHintsForCurrent, revealHint, isSolved, available } =
    useCTF();

  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState("");
  if (!open) return null;
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        inert={!open}
        role="dialog" aria-label="Challenge hints"
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-200"
        style={{
          width: "min(400px, 90vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-base font-medium">Hints</h2>
          <button
            onClick={onClose}
            className="p-1 cursor-pointer"
            style={{ color: "var(--fg-muted)" }}
            aria-label="Close hints"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M6 6l8 8M14 6l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm mb-6" style={{ color: "var(--fg-muted)" }}>
            Revealing a hint deducts points from your score immediately.
          </p>

          {error && <p role="alert">{error}</p>}
          <div className="flex flex-col gap-4">
            {currentChallenge.hints.map((hint, idx) => {
              const isRevealed = revealedHintsForCurrent.includes(idx);

              return (
                <div
                  key={idx}
                  className="rounded-lg p-4"
                  style={{
                    background: "var(--bg)",
                    border: `1px solid ${isRevealed ? "var(--border)" : "var(--border)"}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      Hint {idx + 1}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--accent)" }}
                    >
                      −{hint.cost} pts
                    </span>
                  </div>

                  {isRevealed ? (
                    <p className="text-sm leading-relaxed">{hint.text}</p>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Reveal this hint for ${hint.cost} points? The deduction is permanent.`)) return;
                        setPending(idx); setError("");
                        try { await revealHint(idx); } catch (err) { setError(err instanceof Error ? err.message : "Unable to reveal hint."); } finally { setPending(null); }
                      }}
                      disabled={isSolved || !available || pending !== null}
                      className="text-sm cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ color: "var(--accent)" }}
                    >
                      Reveal hint (−{hint.cost} pts)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

