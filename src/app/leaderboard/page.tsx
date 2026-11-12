import Link from "next/link";
import { HintLeaderboard } from "@/components/HintLeaderboard";
import { PlatformShell } from "@/components/PlatformShell";
import { RoomReveal } from "@/components/RoomReveal";

export default function LeaderboardPage() {
  return (
    <PlatformShell title="Leaderboard">
      <HintLeaderboard />
      <div className="arena-panel">
        <p className="arena-muted">
          Live room scores and the official leaderboard are inside TryHackMe.
        </p>
        <p>
          <Link href="/arena">Back to the challenges</Link>
        </p>
      </div>
      <RoomReveal />
    </PlatformShell>
  );
}
