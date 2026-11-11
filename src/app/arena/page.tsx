"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Room } from "@/components/room/Room";
import { LeaderboardSidebar } from "@/components/LeaderboardSidebar";

export default function Arena() {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <TopBar onLeaderboardClick={() => setLeaderboardOpen(true)} />
      <Room />
      <LeaderboardSidebar open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
    </div>
  );
}
