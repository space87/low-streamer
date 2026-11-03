// Shared contract for rules data and the scoring engine.
// Zero runtime dependencies. zod schemas mirroring these types are added in M0.

export type Seat = "A" | "B";
export const otherSeat = (s: Seat): Seat => (s === "A" ? "B" : "A");

export type DispositionId =
  | "take-and-hold"
  | "purge-the-foe"
  | "disruption"
  | "reconnaissance"
  | "priority-assets";

export type Timing = "end-own-command" | "end-own-turn" | "end-any-turn" | "end-opponent-turn";
export type RoundWindow = { from: number; to: number } | "end-of-battle";

/** Tags that let the map suggest a count/eligibility for a condition. */
export type AutoTag =
  | "objectives-controlled"
  | "objectives-controlled-excl-home"
  | "objectives-controlled-in-opponent-territory"
  | "more-objectives-than-opponent"
  | "central-controlled"
  | "opponent-home-controlled"
  | "own-home-controlled";

export interface Condition {
  id: string;
  label: string;          // short paraphrase, never card text
  vp: number;
  per?: boolean;          // "for each" -> count
  maxVpPerScore?: number; // "(up to X VP)"
  cumulativeOf?: string;  // "+X for each of those" -> count <= parent count, parent required
  auto?: AutoTag;
}

export interface ScoringBlock {
  id: string;
  rounds: RoundWindow;
  timing: Timing;
  round5Timing?: Timing;
  mode?: "fixed" | "tactical";
  exclusive?: boolean;
  conditions: Condition[];
}

export type WhenDrawnRule =
  | { type: "must-redraw-if-round"; round: number; shuffleBack: true }
  | { type: "may-redraw-if-round"; round: number; shuffleBack: true }
  | { type: "may-redraw-if-condition"; prompt: string; shuffleBack: boolean }
  | { type: "may-redraw-if-active"; otherCardId: string; shuffleBack: true }
  | { type: "note"; prompt: string };

export interface Card {
  id: string;
  name: string;
  kind: "primary" | "secondary";
  fixedEligible?: boolean;
  setup?: string;
  actions?: { name: string; summary: string }[];
  whenDrawn?: WhenDrawnRule[];
  blocks: ScoringBlock[];
}

export interface Caps {
  primaryTotal: number;
  primaryPerRound: number;
  secondaryTotal: number;
  secondaryPerRound: number;
  fixedPerCard: number;
  battleReady: number;
  endOfBattleExemptFromRoundCap: boolean;
}

export interface Twist {
  id: string;
  name: string;
  effect: "none" | "mirrored-world" | "scrambled-communications";
  mirroredOptions?: string[];
}

export type ObjectiveKind = "home-attacker" | "home-defender" | "expansion" | "central";
export interface Point { x: number; y: number }

export interface Deployment {
  id: string;
  name: string;
  board: { widthIn: number; depthIn: number };
  zones?: { attacker: Point[]; defender: Point[] };
  objectives: { id: string; kind: ObjectiveKind; x: number; y: number; territory?: "attacker" | "defender" | "none" }[];
}

export interface MissionData {
  version: string;
  source: string;
  lastVerified: string;
  dispositions: { id: DispositionId; name: string }[];
  matrix: Partial<Record<DispositionId, Partial<Record<DispositionId, string>>>>;
  primaries: Card[];
  secondaries: Card[];
  twists: Twist[];
  deployments: Deployment[];
  caps: Caps;
}

export type SecondaryMode = "fixed" | "tactical" | "manual";
export type Phase = "command" | "main" | "turn-end";
export type LedgerSource = "primary" | "secondary" | "battle-ready" | "adjustment";

export interface Selection { conditionId: string; count?: number }

export interface LedgerEntry {
  id: string;
  seat: Seat;
  round: number;
  source: LedgerSource;
  adjustTarget?: "primary" | "secondary";
  cardId?: string;
  blockId?: string;
  selections?: Selection[];
  endOfBattle: boolean;
  rawVp: number;
  awardedVp: number;
  cappedBy: CapReason[];
  note?: string;
  actor: string;
  createdAt: number;
}

export type CapReason = "per-score" | "fixed-card" | "per-round" | "total";

export interface Totals {
  primary: number;
  secondary: number;
  battleReady: number;
  total: number;
  primaryByRound: number[];   // index 0 = round 1 ... 4 = round 5, 5 = end of battle
  secondaryByRound: number[];
  byCard: Record<string, number>;
}
