"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { challenges, type Challenge } from "@/data/challenges";

const STORAGE_KEY = "flagheist-hints-by-team";
const LEGACY_STORAGE_KEY = "flagheist-revealed-hints";
const SESSION_KEY = "flagheist-session";

type TeamHints = Record<string, Record<number, number[]>>;
const EMPTY: TeamHints = {};
const EMPTY_TEAM: Record<number, number[]> = {};
const EMPTY_HINTS: number[] = [];

let revealedState: TeamHints = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStoredHints(): TeamHints {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as TeamHints) : EMPTY;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return EMPTY;
    const legacy = JSON.parse(legacyRaw);
    if (!legacy || typeof legacy !== "object") return EMPTY;

    const sessionRaw = window.localStorage.getItem(SESSION_KEY);
    const session = sessionRaw
      ? (JSON.parse(sessionRaw) as { username?: unknown })
      : null;
    const username =
      typeof session?.username === "string" ? session.username : null;
    if (!username) return EMPTY;

    const migrated: TeamHints = { [username]: legacy as Record<number, number[]> };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): TeamHints {
  if (!loaded) {
    revealedState = readStoredHints();
    loaded = true;
  }
  return revealedState;
}

function getServerSnapshot(): TeamHints {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function persist(next: TeamHints) {
  revealedState = next;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((listener) => listener());
}

function totalDeductedFor(teamHints: Record<number, number[]>) {
  return Object.entries(teamHints).reduce((total, [challengeId, hintIndexes]) => {
    const challenge = challenges.find((entry) => entry.id === Number(challengeId));
    if (!challenge) return total;
    return (
      total +
      hintIndexes.reduce(
        (sum, hintIndex) => sum + (challenge.hints[hintIndex]?.cost ?? 0),
        0,
      )
    );
  }, 0);
}

function totalHintsFor(teamHints: Record<number, number[]>) {
  return Object.values(teamHints).reduce(
    (total, hintIndexes) => total + hintIndexes.length,
    0,
  );
}

interface CTFContextValue {
  currentChallenge: Challenge;
  index: number;
  revealedHintsForCurrent: number[];
  totalChallenges: number;
  totalDeducted: number;
  totalHints: number;
  revealHint: (
    hintIndex: number,
  ) => Promise<{ success: boolean; cost: number; tracked: boolean }>;
  goToNext: () => void;
  goToPrev: () => void;
  goToChallenge: (index: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

const CTFContext = createContext<CTFContextValue | null>(null);

export function useCTF() {
  const ctx = useContext(CTFContext);
  if (!ctx) throw new Error("useCTF must be inside CTFProvider");
  return ctx;
}

export function CTFProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const { user } = useAuth();
  const allRevealed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const currentChallenge = challenges[index];
  const team = user?.username ?? null;
  const teamHints = team ? allRevealed[team] ?? EMPTY_TEAM : EMPTY_TEAM;
  const revealedHintsForCurrent =
    teamHints[currentChallenge.id] ?? EMPTY_HINTS;
  const totalDeducted = useMemo(() => totalDeductedFor(teamHints), [teamHints]);
  const totalHints = useMemo(() => totalHintsFor(teamHints), [teamHints]);

  const revealHint = useCallback(
    async (hintIndex: number) => {
      const hint = currentChallenge.hints[hintIndex];
      if (!hint || !team) return { success: false, cost: 0, tracked: false };

      const snapshot = getSnapshot();
      const snapshotTeamHints = snapshot[team] ?? EMPTY_TEAM;
      const current = snapshotTeamHints[currentChallenge.id] ?? EMPTY_HINTS;

      if (!current.includes(hintIndex)) {
        persist({
          ...snapshot,
          [team]: {
            ...snapshotTeamHints,
            [currentChallenge.id]: [...current, hintIndex],
          },
        });
      }

      try {
        const response = await fetch("/api/hints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team,
            challengeId: currentChallenge.id,
            hintIndex,
          }),
        });
        if (!response.ok) throw new Error("Unable to record hint.");
        return { success: true, cost: hint.cost, tracked: true };
      } catch {
        return { success: true, cost: hint.cost, tracked: false };
      }
    },
    [currentChallenge, team],
  );

  return (
    <CTFContext.Provider
      value={{
        currentChallenge,
        index,
        revealedHintsForCurrent,
        totalChallenges: challenges.length,
        totalDeducted,
        totalHints,
        revealHint,
        goToNext: () => setIndex((i) => Math.min(challenges.length - 1, i + 1)),
        goToPrev: () => setIndex((i) => Math.max(0, i - 1)),
        canGoNext: index < challenges.length - 1,
        canGoPrev: index > 0,
        goToChallenge: (next) =>
          setIndex(Math.min(challenges.length - 1, Math.max(0, next))),
      }}
    >
      {children}
    </CTFContext.Provider>
  );
}
