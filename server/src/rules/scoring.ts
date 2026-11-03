import type {
  Caps, Card, CapReason, LedgerEntry, LedgerSource, Phase, ScoringBlock, Seat,
  SecondaryMode, Selection, Timing, Totals,
} from "../../../shared/src/types.ts";

export class RulesError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Raw VP for one scoring instance of one block, before any game-level caps. */
export function scoreBlock(block: ScoringBlock, selections: Selection[]): { rawVp: number; perScoreCapped: boolean } {
  if (selections.length === 0) throw new RulesError("empty", "Select at least one condition");
  const byId = new Map(block.conditions.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let raw = 0;
  let perScoreCapped = false;

  for (const sel of selections) {
    const cond = byId.get(sel.conditionId);
    if (!cond) throw new RulesError("unknown-condition", `Unknown condition ${sel.conditionId} in block ${block.id}`);
    if (seen.has(sel.conditionId)) throw new RulesError("duplicate", `Condition ${sel.conditionId} selected twice`);
    seen.add(sel.conditionId);
  }

  // Exclusive (OR) blocks: at most one non-cumulative condition.
  if (block.exclusive) {
    const base = selections.filter((s) => !byId.get(s.conditionId)!.cumulativeOf);
    if (base.length > 1) throw new RulesError("exclusive", "Only one of these options can be scored at a time");
  }

  for (const sel of selections) {
    const cond = byId.get(sel.conditionId)!;
    let count = 1;
    if (cond.per) {
      count = sel.count ?? 0;
      if (!Number.isInteger(count) || count < 1) throw new RulesError("count", `Enter how many for "${cond.label}"`);
    } else if (sel.count !== undefined && sel.count !== 1) {
      throw new RulesError("count", `"${cond.label}" is not a per-count condition`);
    }
    if (cond.cumulativeOf) {
      const parentSel = selections.find((s) => s.conditionId === cond.cumulativeOf);
      if (!parentSel) throw new RulesError("cumulative-parent", `"${cond.label}" needs its main condition selected`);
      const parent = byId.get(cond.cumulativeOf)!;
      const parentCount = parent.per ? parentSel.count ?? 0 : 1;
      if (count > parentCount) throw new RulesError("cumulative-count", `"${cond.label}" can't exceed ${parentCount}`);
    }
    let vp = cond.vp * count;
    if (cond.maxVpPerScore !== undefined && vp > cond.maxVpPerScore) {
      vp = cond.maxVpPerScore;
      perScoreCapped = true;
    }
    raw += vp;
  }
  return { rawVp: raw, perScoreCapped };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Effective source an entry counts towards. */
export function entryTarget(e: Pick<LedgerEntry, "source" | "adjustTarget">): "primary" | "secondary" | "battle-ready" {
  if (e.source === "adjustment") return e.adjustTarget ?? "primary";
  return e.source;
}

export interface CapInput {
  seat: Seat;
  target: "primary" | "secondary";
  round: number;
  endOfBattle: boolean;
  cardId?: string;
  secondaryMode?: SecondaryMode;
  rawVp: number;
}

/** Applies caps in order: fixed card -> per round (unless end-of-battle exempt) -> total. */
export function applyCaps(ledger: LedgerEntry[], caps: Caps, input: CapInput): { awardedVp: number; cappedBy: CapReason[] } {
  const mine = ledger.filter((e) => e.seat === input.seat && entryTarget(e) === input.target);
  const cappedBy: CapReason[] = [];
  let awarded = input.rawVp;

  if (input.target === "secondary" && input.secondaryMode === "fixed" && input.cardId) {
    const onCard = sum(mine.filter((e) => e.cardId === input.cardId).map((e) => e.awardedVp));
    const room = Math.max(0, caps.fixedPerCard - onCard);
    if (awarded > room) { awarded = room; cappedBy.push("fixed-card"); }
  }

  const exempt = input.endOfBattle && caps.endOfBattleExemptFromRoundCap;
  if (!exempt) {
    const perRound = input.target === "primary" ? caps.primaryPerRound : caps.secondaryPerRound;
    const inRound = sum(mine.filter((e) => e.round === input.round && !e.endOfBattle).map((e) => e.awardedVp));
    const room = Math.max(0, perRound - inRound);
    if (awarded > room) { awarded = room; cappedBy.push("per-round"); }
  }

  const totalCap = input.target === "primary" ? caps.primaryTotal : caps.secondaryTotal;
  const room = Math.max(0, totalCap - sum(mine.map((e) => e.awardedVp)));
  if (awarded > room) { awarded = room; cappedBy.push("total"); }

  return { awardedVp: Math.max(0, awarded), cappedBy };
}

export interface ScoreRequest {
  id: string;
  seat: Seat;
  round: number;
  card: Card;
  blockId: string;
  selections: Selection[];
  secondaryMode?: SecondaryMode;
  actor: string;
  now: number;
}

/** Builds a complete ledger entry for a card score (primary or secondary). */
export function buildScoreEntry(ledger: LedgerEntry[], caps: Caps, req: ScoreRequest): LedgerEntry {
  const block = req.card.blocks.find((b) => b.id === req.blockId);
  if (!block) throw new RulesError("unknown-block", `Unknown block ${req.blockId} on ${req.card.id}`);
  if (req.card.kind === "secondary" && block.mode && req.secondaryMode) {
    const effective = req.secondaryMode === "manual" ? "tactical" : req.secondaryMode;
    if (block.mode !== effective) throw new RulesError("mode", `This option is for ${block.mode} missions only`);
  }
  const { rawVp, perScoreCapped } = scoreBlock(block, req.selections);
  const endOfBattle = block.rounds === "end-of-battle";
  const target = req.card.kind === "primary" ? "primary" : "secondary";
  const capped = applyCaps(ledger, caps, {
    seat: req.seat, target, round: req.round, endOfBattle, cardId: req.card.id,
    secondaryMode: req.secondaryMode, rawVp,
  });
  return {
    id: req.id, seat: req.seat, round: req.round, source: target,
    cardId: req.card.id, blockId: block.id, selections: req.selections, endOfBattle,
    rawVp, awardedVp: capped.awardedVp,
    cappedBy: perScoreCapped ? (["per-score", ...capped.cappedBy] as CapReason[]) : capped.cappedBy,
    actor: req.actor, createdAt: req.now,
  };
}

/**
 * Manual adjustment (positive or negative). Respects the same caps as card scores:
 * the round never exceeds the per-round cap or drops below 0, and the game total stays within [0, total cap].
 */
export function buildAdjustment(
  ledger: LedgerEntry[], caps: Caps,
  req: { id: string; seat: Seat; round: number; target: "primary" | "secondary"; vp: number; note: string; actor: string; now: number },
): LedgerEntry {
  if (!req.note.trim()) throw new RulesError("note", "Adjustments need a reason");
  if (!Number.isInteger(req.vp) || req.vp === 0) throw new RulesError("vp", "Enter a whole, non-zero VP change");
  const mine = ledger.filter((e) => e.seat === req.seat && entryTarget(e) === req.target);
  const total = sum(mine.map((e) => e.awardedVp));
  const inRound = sum(mine.filter((e) => e.round === req.round && !e.endOfBattle).map((e) => e.awardedVp));
  const totalCap = req.target === "primary" ? caps.primaryTotal : caps.secondaryTotal;
  const roundCap = req.target === "primary" ? caps.primaryPerRound : caps.secondaryPerRound;
  const cappedBy: CapReason[] = [];
  let awarded = req.vp;
  if (awarded > 0) {
    if (awarded > roundCap - inRound) { awarded = Math.max(0, roundCap - inRound); cappedBy.push("per-round"); }
    if (awarded > totalCap - total) { awarded = Math.max(0, totalCap - total); cappedBy.push("total"); }
  } else {
    if (awarded < -inRound) { awarded = -inRound; cappedBy.push("per-round"); }
    if (awarded < -total) { awarded = -total; cappedBy.push("total"); }
  }
  return {
    id: req.id, seat: req.seat, round: req.round, source: "adjustment", adjustTarget: req.target,
    endOfBattle: false, rawVp: req.vp, awardedVp: awarded, cappedBy, note: req.note, actor: req.actor, createdAt: req.now,
  };
}

export function buildBattleReady(ledger: LedgerEntry[], caps: Caps, req: { id: string; seat: Seat; actor: string; now: number }): LedgerEntry {
  if (ledger.some((e) => e.seat === req.seat && e.source === "battle-ready")) {
    throw new RulesError("duplicate", "Battle Ready already recorded");
  }
  return {
    id: req.id, seat: req.seat, round: 5, source: "battle-ready", endOfBattle: true,
    rawVp: caps.battleReady, awardedVp: caps.battleReady, cappedBy: [], actor: req.actor, createdAt: req.now,
  };
}

/** Totals are always derived from the ledger. */
export function computeTotals(ledger: LedgerEntry[], seat: Seat): Totals {
  const t: Totals = {
    primary: 0, secondary: 0, battleReady: 0, total: 0,
    primaryByRound: [0, 0, 0, 0, 0, 0], secondaryByRound: [0, 0, 0, 0, 0, 0], byCard: {},
  };
  for (const e of ledger) {
    if (e.seat !== seat) continue;
    const target = entryTarget(e);
    const slot = e.endOfBattle ? 5 : Math.min(Math.max(e.round, 1), 5) - 1;
    if (target === "primary") { t.primary += e.awardedVp; t.primaryByRound[slot] += e.awardedVp; }
    else if (target === "secondary") { t.secondary += e.awardedVp; t.secondaryByRound[slot] += e.awardedVp; }
    else t.battleReady += e.awardedVp;
    if (e.cardId) t.byCard[e.cardId] = (t.byCard[e.cardId] ?? 0) + e.awardedVp;
  }
  t.total = t.primary + t.secondary + t.battleReady;
  return t;
}

export interface TurnContext {
  round: number;
  phase: Phase;
  activeSeat: Seat;
  battleEnded: boolean;
}

function timingOpen(timing: Timing, seat: Seat, ctx: TurnContext): boolean {
  const mine = ctx.activeSeat === seat;
  switch (timing) {
    case "end-own-command": return mine && ctx.phase === "command";
    case "end-own-turn": return mine && ctx.phase === "turn-end";
    case "end-opponent-turn": return !mine && ctx.phase === "turn-end";
    case "end-any-turn": return ctx.phase === "turn-end";
  }
}

/** Which blocks on a card can be scored right now (used for "score now" highlights). */
export function availableBlocks(card: Card, seat: Seat, ctx: TurnContext, secondaryMode?: SecondaryMode): string[] {
  const mode = secondaryMode === "manual" ? "tactical" : secondaryMode;
  return card.blocks
    .filter((b) => !b.mode || !mode || b.mode === mode)
    .filter((b) => {
      if (b.rounds === "end-of-battle") return ctx.battleEnded;
      if (ctx.battleEnded) return false;
      if (ctx.round < b.rounds.from || ctx.round > b.rounds.to) return false;
      const timing = ctx.round === 5 && b.round5Timing ? b.round5Timing : b.timing;
      return timingOpen(timing, seat, ctx);
    })
    .map((b) => b.id);
}

export function sourceOf(card: Card): LedgerSource {
  return card.kind === "primary" ? "primary" : "secondary";
}
