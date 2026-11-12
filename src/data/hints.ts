export interface HintRecord {
  team: string;
  challengeId: number;
  hintIndex: number;
  cost: number;
  createdAt: string;
}

export interface TeamHintTotal {
  team: string;
  total: number;
  hints: number;
  details: Array<{
    challengeId: number;
    hintIndex: number;
    cost: number;
    createdAt: string;
  }>;
}

export interface HintTotalsResponse {
  teams: TeamHintTotal[];
  updatedAt: string;
}
