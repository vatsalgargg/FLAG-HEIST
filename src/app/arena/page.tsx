"use client";

import { challenges } from "@/data/challenges";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ChallengeCard } from "@/components/ChallengeCard";
import { FlagInput } from "@/components/FlagInput";
import { ChallengeNav } from "@/components/ChallengeNav";
import { ProgressBar } from "@/components/ProgressBar";
import { ChallengeStepper } from "@/components/ChallengeStepper";
import { HintSidebar } from "@/components/HintSidebar";
import { useCTF } from "@/context/CTFContext";
import { LeaderboardSidebar } from "@/components/LeaderboardSidebar";

export default function Arena() {
  const { currentChallenge, goToChallenge, unlockedIndex } = useCTF();
  const [hintsOpen, setHintsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <TopBar
        onHintsClick={() => {
          setHintsOpen(true);
          setLeaderboardOpen(false);
        }}
        onLeaderboardClick={() => {
          setLeaderboardOpen(true);
          setHintsOpen(false);
        }}
      />

      <div className="flex-1 flex">
        {/* Left stepper — visible on larger screens */}
        <aside
          className="hidden lg:flex flex-col w-64 flex-shrink-0 p-4 overflow-y-auto"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <p className="text-xs font-medium mb-4 px-3" style={{ color: "var(--fg-muted)" }}>
            Challenges
          </p>
          <ChallengeStepper />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 w-full flex flex-col max-w-2xl mx-auto px-6 py-10 gap-8">
          <label className="lg:hidden arena-form arena-mobile-selector">Challenge<select value={currentChallenge.id - 1} onChange={e => goToChallenge(Number(e.target.value))}>{challenges.map((ch, i) => <option value={i} key={ch.id} disabled={i > unlockedIndex}>{ch.title}</option>)}</select></label>
          <ProgressBar />
          <ChallengeCard />
          <FlagInput key={currentChallenge.id} />
          <ChallengeNav />
        </main>
      </div>

      {/* Overlay sidebars */}
      <HintSidebar open={hintsOpen} onClose={() => setHintsOpen(false)} />
      <LeaderboardSidebar
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
    </div>
  );
}

