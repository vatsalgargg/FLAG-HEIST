export interface FinalLeaderboardEntry {
  team: string;
  tasksSolved: number;
  roomScore: number;
  hintsUsed: number;
  hintDeduction: number;
  finalScore: number;
}

export const TOTAL_TASKS = 14;

export const LEADERBOARD_LOCKED_NOTE =
  "Final standings are locked. Scores combine TryHackMe room task progress with hint deductions recorded during the event. No further changes can be made.";

const rawEntries: Omit<FinalLeaderboardEntry, "finalScore">[] = [
  { team: "GrandZeno", tasksSolved: 13, roomScore: 180, hintsUsed: 1, hintDeduction: 3 },
  { team: "Obsidian", tasksSolved: 13, roomScore: 180, hintsUsed: 3, hintDeduction: 11 },
  { team: "U Kruthik", tasksSolved: 13, roomScore: 185, hintsUsed: 6, hintDeduction: 24 },
  { team: "Two of Us", tasksSolved: 14, roomScore: 200, hintsUsed: 12, hintDeduction: 46 },
  { team: "Chintu coders", tasksSolved: 11, roomScore: 150, hintsUsed: 0, hintDeduction: 0 },
  { team: "Pranav r ghetia", tasksSolved: 11, roomScore: 150, hintsUsed: 4, hintDeduction: 14 },
  { team: "cmdAgent", tasksSolved: 10, roomScore: 135, hintsUsed: 0, hintDeduction: 0 },
  { team: "GheeKhatam", tasksSolved: 14, roomScore: 200, hintsUsed: 18, hintDeduction: 68 },
  { team: "STL", tasksSolved: 9, roomScore: 120, hintsUsed: 0, hintDeduction: 0 },
  { team: "BickandDalls", tasksSolved: 10, roomScore: 135, hintsUsed: 5, hintDeduction: 21 },
  { team: "Hard Coders", tasksSolved: 5, roomScore: 60, hintsUsed: 0, hintDeduction: 0 },
  { team: "404FlagFound", tasksSolved: 4, roomScore: 45, hintsUsed: 0, hintDeduction: 0 },
  { team: "Cyberleek", tasksSolved: 4, roomScore: 45, hintsUsed: 0, hintDeduction: 0 },
  { team: "Dihaadi Majdoor", tasksSolved: 4, roomScore: 45, hintsUsed: 0, hintDeduction: 0 },
  { team: "MEOW MAFIA", tasksSolved: 4, roomScore: 45, hintsUsed: 0, hintDeduction: 0 },
  { team: "aef", tasksSolved: 2, roomScore: 30, hintsUsed: 0, hintDeduction: 0 },
  { team: "Data", tasksSolved: 1, roomScore: 15, hintsUsed: 0, hintDeduction: 0 },
  { team: "3FORCE", tasksSolved: 1, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "PUTAAPU GANG", tasksSolved: 1, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "Subway Surfers", tasksSolved: 1, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "Team getaway", tasksSolved: 1, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "The Brawlers", tasksSolved: 1, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "Midnight Paradox", tasksSolved: 1, roomScore: 0, hintsUsed: 4, hintDeduction: 16 },
  { team: "Clankers", tasksSolved: 0, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "HIEST MASTERMINDS", tasksSolved: 0, roomScore: 0, hintsUsed: 0, hintDeduction: 0 },
  { team: "Big Yahu", tasksSolved: 0, roomScore: 0, hintsUsed: 4, hintDeduction: 16 },
];

export const finalLeaderboard: FinalLeaderboardEntry[] = rawEntries
  .map((entry) => ({
    ...entry,
    finalScore: Math.max(0, entry.roomScore - entry.hintDeduction),
  }))
  .sort(
    (a, b) =>
      b.finalScore - a.finalScore ||
      b.roomScore - a.roomScore ||
      b.tasksSolved - a.tasksSolved ||
      a.hintsUsed - b.hintsUsed ||
      a.team.localeCompare(b.team),
  );
