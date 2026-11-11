"use client";
import Link from "next/link";
import { Leaderboard } from "./Leaderboard";
export function LeaderboardSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <><div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} /><section role="dialog" aria-label="Leaderboard" className="fixed top-0 right-0 h-full z-50 w-[min(480px,95vw)] overflow-auto p-6" style={{ background: "var(--surface)" }}><div className="flex justify-between gap-4 mb-6"><h2>Leaderboard</h2><button onClick={onClose}>Close</button></div><Leaderboard /><Link href="/leaderboard">Open full scoreboard</Link></section></>;
}
