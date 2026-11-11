"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useCTF } from "@/context/CTFContext";

interface TopBarProps {
  onHintsClick: () => void;
  onLeaderboardClick: () => void;
}

export function TopBar({ onHintsClick, onLeaderboardClick }: TopBarProps) {
  const router = useRouter();
  const { team } = useCTF();

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold tracking-tight"><Link href="/">Flag Heist</Link></h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Score */}
        <span
          className="text-sm font-mono px-3 py-1.5 rounded"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {team.score} pts
        </span>

        {/* Hints button */}
        <button
          onClick={onHintsClick}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M6.5 6.5a1.5 1.5 0 1 1 1.5 1.5v1"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" />
          </svg>
          Hints
        </button>

        {/* Leaderboard button */}
        <button
          onClick={onLeaderboardClick}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="8" width="3" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
            <rect x="6.5" y="4" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
            <rect x="11" y="6" width="3" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Leaderboard
        </button>

        <button className="text-sm cursor-pointer" onClick={async () => { try { await api("/auth/logout", {}); router.replace("/login"); router.refresh(); } catch { window.alert("Logout failed. Please try again."); } }}>Log out</button>
        {/* Team name */}
        <span
          className="text-xs ml-2 px-2 py-1 rounded"
          style={{ color: "var(--fg-muted)" }}
        >
          {team.teamName}
        </span>
      </div>
    </header>
  );
}

