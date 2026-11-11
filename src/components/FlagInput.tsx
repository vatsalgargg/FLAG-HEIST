"use client";

import { useState, type FormEvent } from "react";
import { useCTF } from "@/context/CTFContext";

export function FlagInput() {
  const { submitFlag, isSolved, currentChallenge, available } = useCTF();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (busy || !available) return;
    setBusy(true);
    const result = await submitFlag(value);
    setBusy(false);
    setFeedback(result);
    if (result.success) setValue("");
    setTimeout(() => setFeedback(null), 3000);
  };

  const challengeId = currentChallenge.id;

  if (isSolved) {
    return (
      <div
        className="flex items-center gap-3 px-5 py-4 rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--success)" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M6 10l3 3 5-6"
            stroke="var(--success)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ color: "var(--success)" }}>Challenge solved</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" key={challengeId}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          aria-label="Challenge flag"
          disabled={busy || !available}
          maxLength={256}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ROOT{...}"
          className="flex-1 px-4 py-3 rounded-lg text-sm outline-none transition-colors"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            fontFamily: "var(--font-mono), monospace",
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={busy || !available || !value.trim()}
          className="px-6 py-3 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 cursor-pointer"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {busy ? "Submitting…" : "Submit"}
        </button>
      </div>
      {feedback && (
        <p role="status"
          className="text-sm pl-1"
          style={{
            color: feedback.success ? "var(--success)" : "var(--accent)",
          }}
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}

