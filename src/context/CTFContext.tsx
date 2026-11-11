"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import Link from "next/link";
import { challenges, type Challenge } from "@/data/challenges";
import { api, ApiError } from "@/lib/api";
import { PlatformShell } from "@/components/PlatformShell";

type RemoteChallenge = {
  id: number;
  points: number;
  isActive: boolean;
  solved: boolean;
  targetUrl: string | null;
  accessInfo: string | null;
  collabInfo: { callbackUrl: string; logUrl: string } | null;
  hints: {
    id: string;
    cost: number;
    content: string | null;
    revealed: boolean;
  }[];
};
type Dashboard = {
  team: { teamName: string; score: number };
  challenges: RemoteChallenge[];
};
type SolveStat = {
  challenge_id: number;
  solve_count: number;
  first_blood: { team_name: string } | null;
};
interface CTFContextValue {
  team: {
    teamName: string;
    score: number;
    currentChallengeIndex: number;
    solvedChallenges: Set<number>;
    hintPenalties: number;
  };
  currentChallenge: Challenge;
  isSolved: boolean;
  revealedHintsForCurrent: number[];
  available: boolean;
  accessInfo: string | null;
  collabInfo: RemoteChallenge["collabInfo"];
  stat?: SolveStat;
  submitFlag: (flag: string) => Promise<{ success: boolean; message: string }>;
  revealHint: (index: number) => Promise<{ success: boolean; cost: number }>;
  goToNext: () => void;
  goToPrev: () => void;
  goToChallenge: (index: number) => void;
  unlockedIndex: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  totalChallenges: number;
  solvedCount: number;
}
const CTFContext = createContext<CTFContextValue | null>(null);
export function useCTF() {
  const ctx = useContext(CTFContext);
  if (!ctx) throw new Error("useCTF must be inside CTFProvider");
  return ctx;
}
export function CTFProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<SolveStat[]>([]);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await api<Dashboard>("/dashboard?fresh=true");
      setDashboard(data);
      setError("");
      setUnauthorized(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load competition.",
      );
      if (err instanceof ApiError && err.status === 401) {
        setDashboard(null);
        setUnauthorized(true);
      }
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => {
      void refresh();
    }, 0);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const load = () =>
      api<SolveStat[]>("/stats/solves")
        .then(setStats)
        .catch(() => {});
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  const remote = dashboard?.challenges.find(
    (ch) => ch.id === challenges[index].id,
  );
  const currentChallenge: Challenge = {
    ...challenges[index],
    points: remote?.points ?? challenges[index].points,
    hints:
      remote?.hints.map((h) => ({
        id: h.id,
        cost: h.cost,
        text: h.content || "",
      })) ?? [],
    providedAssets: [
      ...(challenges[index].providedAssets ?? []),
      ...(remote?.targetUrl
        ? [{ label: "Open challenge site", href: remote.targetUrl }]
        : []),
    ],
  };
  async function submitFlag(flag: string) {
    try {
      const result = await api<{ status: string; message: string }>("/submit", {
        challenge_id: currentChallenge.id,
        flag,
      });
      await refresh();
      return {
        success:
          result.status === "correct" || result.status === "already_solved",
        message: result.message,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Submission failed.",
      };
    }
  }
  async function revealHint(hintIndex: number) {
    const hint = remote?.hints[hintIndex];
    if (!hint) return { success: false, cost: 0 };
    await api(`/hints/${hint.id}/reveal`, {});
    await refresh();
    return { success: true, cost: hint.cost };
  }
  if (!dashboard)
    return (
      <PlatformShell
        title={unauthorized ? "Join the investigation" : "Competition"}
      >
        <div className="arena-panel">
          <p role="status">
            {unauthorized
              ? "Log in with your team account to continue."
              : error || "Loading competition…"}
          </p>
          {unauthorized ? (
            <p>
              <Link href="/login">Team login</Link>
            </p>
          ) : (
            error && <button onClick={refresh}>Try again</button>
          )}
        </div>
      </PlatformShell>
    );
  const solvedChallenges = new Set(
    dashboard.challenges.filter((ch) => ch.solved).map((ch) => ch.id),
  );
  const firstUnsolved = challenges.findIndex(
    (ch) => !solvedChallenges.has(ch.id),
  );
  const unlockedIndex =
    firstUnsolved === -1 ? challenges.length - 1 : firstUnsolved;
  const hintPenalties = dashboard.challenges
    .flatMap((ch) => ch.hints)
    .filter((h) => h.revealed)
    .reduce((sum, h) => sum + h.cost, 0);
  return (
    <CTFContext.Provider
      value={{
        team: {
          ...dashboard.team,
          currentChallengeIndex: index,
          solvedChallenges,
          hintPenalties,
        },
        currentChallenge,
        isSolved: solvedChallenges.has(currentChallenge.id),
        revealedHintsForCurrent:
          remote?.hints.flatMap((h, i) => (h.revealed ? [i] : [])) ?? [],
        available: remote?.isActive ?? false,
        accessInfo: remote?.accessInfo ?? null,
        collabInfo: remote?.collabInfo ?? null,
        stat: stats.find((s) => s.challenge_id === currentChallenge.id),
        submitFlag,
        revealHint,
        goToNext: () => setIndex((i) => Math.min(unlockedIndex, i + 1)),
        goToPrev: () => setIndex((i) => Math.max(0, i - 1)),
        unlockedIndex,
        goToChallenge: (i) => setIndex(Math.min(unlockedIndex, Math.max(0, i))),
        canGoNext: index < challenges.length - 1,
        canGoPrev: index > 0,
        totalChallenges: challenges.length,
        solvedCount: solvedChallenges.size,
      }}
    >
      {error && (
        <p className="arena-announcement" role="alert">
          {error}
        </p>
      )}
      {children}
    </CTFContext.Provider>
  );
}
