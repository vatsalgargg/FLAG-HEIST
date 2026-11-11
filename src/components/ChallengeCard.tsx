"use client";

import { useCTF } from "@/context/CTFContext";

export function ChallengeCard() {
  const { currentChallenge, isSolved, available, accessInfo, collabInfo, stat } = useCTF();
  const ch = currentChallenge;

  return (
    <div className="flex flex-col gap-6">
      {/* Tier + Points */}
      <div className="flex items-center gap-3">
        <span
          className="text-xs px-2 py-1 rounded"
          style={{
            background: "var(--border)",
            color: "var(--fg-muted)",
          }}
        >
          {ch.tier}
        </span>
        <span className="text-xs font-mono" style={{ color: "var(--fg-muted)" }}>
          {ch.points} pts
        </span>
        {isSolved && (
          <span className="text-xs font-mono" style={{ color: "var(--success)" }}>
            Solved
          </span>
        )}
      </div>

      {!available && <p role="status" className="arena-announcement">Temporarily unavailable. The organisers are checking this challenge.</p>}
      {stat && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{stat.solve_count} solves{stat.first_blood ? ` · First blood: ${stat.first_blood.team_name}` : " · First blood unclaimed"}</p>}
      {accessInfo && <p className="text-sm break-words">{accessInfo}</p>}
      {collabInfo && <div className="arena-panel break-all"><p>Your team callback: <code>{collabInfo.callbackUrl}</code></p><a href={collabInfo.logUrl} target="_blank" rel="noopener noreferrer">Open team callback log</a></div>}
      {/* Title */}
      <h2 className="text-2xl font-semibold leading-tight tracking-tight">
        {ch.title}
      </h2>

      {/* Story beat */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
        {ch.storyBeat}
      </p>

      {/* Narrative */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-medium mb-3" style={{ color: "var(--fg-muted)" }}>
          Intel
        </p>
        <p className="text-sm leading-relaxed">{ch.narrative}</p>
      </div>

      {/* Briefing */}
      <div>
        <p className="text-xs font-medium mb-3" style={{ color: "var(--fg-muted)" }}>
          Briefing
        </p>
        <p className="text-sm leading-relaxed">{ch.briefing}</p>
      </div>

      {/* Provided assets */}
      {ch.providedAssets && ch.providedAssets.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: "var(--fg-muted)" }}>
            Provided assets
          </p>
          <div className="flex flex-wrap gap-3">
            {ch.providedAssets.map((asset) => (
              <a
                key={asset.label}
                href={asset.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-opacity hover:opacity-80"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 11l8-8M5 3h6v6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {asset.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

