"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface TopBarProps {
  onHintsClick: () => void;
}

export function TopBar({ onHintsClick }: TopBarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold tracking-tight">
          <Link href="/">Flag Heist</Link>
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user && (
          <>
            <span
              className="max-w-[16rem] truncate text-sm px-1"
              style={{ color: "var(--fg-muted)" }}
              title={user.username}
            >
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              Log out
            </button>
          </>
        )}
        <Link
          href="/leaderboard"
          className="text-sm px-3 py-1.5 rounded transition-opacity hover:opacity-80"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          Info
        </Link>
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
      </div>
    </header>
  );
}
