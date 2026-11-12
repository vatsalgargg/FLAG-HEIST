import Link from "next/link";
import { HintLeaderboard } from "@/components/HintLeaderboard";
import { PlatformShell } from "@/components/PlatformShell";

export default function AdminPage() {
  return (
    <PlatformShell title="Organiser controls">
      <div className="arena-panel">
        <p className="arena-muted">
          Hint usage is tracked centrally on this site. Challenge content and
          hints are managed here; solving and scoring now happen in the
          TryHackMe room.
        </p>
        <p>
          <Link href="/arena">Open the challenge guide</Link>
        </p>
      </div>
      <HintLeaderboard />
    </PlatformShell>
  );
}
