"use client";

import { useState } from "react";
import Link from "next/link";
import { useCTF } from "@/context/CTFContext";
import { Leaderboard } from "@/components/Leaderboard";
import { TaskItem } from "./TaskItem";
import s from "./Room.module.css";

export function Room() {
  const { tasks, team, solvedCount, totalChallenges } = useCTF();
  const firstOpen = tasks.find((t) => t.state === "open")?.index ?? 0;
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([firstOpen]));
  const pct = totalChallenges ? Math.round((solvedCount / totalChallenges) * 100) : 0;
  const totalPoints = tasks.reduce((sum, t) => sum + t.challenge.points, 0);

  const toggle = (i: number) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className={s.room}>
      <header className={s.banner}>
        <p className={s.kicker}>Room · Incident Investigation</p>
        <h1 className={s.title}>Flag Heist: The Veyra Breach</h1>
        <p className={s.tagline}>
          Veyra Cloud Solutions was breached. Retrace the attacker&apos;s path — from a forgotten
          staging site to the final cover-up — one task at a time.
        </p>
        <div className={s.chips}>
          <span className={s.chip}>{totalChallenges} tasks</span>
          <span className={s.chip}>Intro → Final</span>
          <span className={s.chip}>Web · Crypto · OSINT · Forensics</span>
          <span className={s.chip}>{totalPoints} pts available</span>
        </div>
        <div className={s.progressWrap}>
          <div className={s.progressLabel}>
            <span>Room progress</span>
            <span>
              {solvedCount}/{totalChallenges} · {pct}%
            </span>
          </div>
          <div className={s.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className={s.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <main className={s.tasks}>
        {tasks.map((t) => (
          <TaskItem key={t.challenge.id} task={t} open={openSet.has(t.index)} onToggle={() => toggle(t.index)} />
        ))}
      </main>

      <aside className={s.side}>
        <div className={s.card}>
          <p className={s.cardTitle}>Your team</p>
          <div className={s.statRow}><span>{team.teamName}</span></div>
          <div className={s.statRow}><span>Score</span><span className={s.statVal}>{team.score}</span></div>
          <div className={s.statRow}><span>Tasks completed</span><span className={s.statVal}>{solvedCount}/{totalChallenges}</span></div>
          <div className={s.statRow}><span>Hint penalties</span><span className={s.statVal}>−{team.hintPenalties}</span></div>
        </div>
        <div className={s.card}>
          <p className={s.cardTitle}>How this room works</p>
          <ul className={s.rules}>
            {tasks.some((t) => t.state === "locked") && <li>Tasks unlock in order — solve one to open the next.</li>}
            <li>Each task has one answer: its flag, in <code>ROOT{"{...}"}</code> format.</li>
            <li>Hints cost points and the deduction is permanent.</li>
            <li>Only attack the targets linked inside each task.</li>
          </ul>
        </div>
        <div className={s.card}>
          <p className={s.cardTitle}>Leaderboard</p>
          <Leaderboard />
          <Link href="/leaderboard" style={{ color: "#f07878", fontSize: 14 }}>Full scoreboard</Link>
        </div>
      </aside>
    </div>
  );
}
