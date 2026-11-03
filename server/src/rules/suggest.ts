import type { AutoTag, ObjectiveKind, ScoringBlock, Seat, Selection } from "../../../shared/src/types.ts";

export type Control = Seat | "contested" | null;
export interface MapObjective { id: string; kind: ObjectiveKind; territory?: "attacker" | "defender" | "none"; controlledBy: Control }
export interface MapContext { objectives: MapObjective[]; attackerSeat: Seat }

function homeOf(seat: Seat, attacker: Seat): ObjectiveKind {
  return seat === attacker ? "home-attacker" : "home-defender";
}

/** Count or yes/no for one auto tag from the map. */
export function evaluateAuto(tag: AutoTag, seat: Seat, map: MapContext): number {
  const opp: Seat = seat === "A" ? "B" : "A";
  const mine = map.objectives.filter((o) => o.controlledBy === seat);
  const theirs = map.objectives.filter((o) => o.controlledBy === opp);
  const myHome = homeOf(seat, map.attackerSeat);
  const oppHome = homeOf(opp, map.attackerSeat);
  const oppTerritory = seat === map.attackerSeat ? "defender" : "attacker";
  switch (tag) {
    case "objectives-controlled": return mine.length;
    case "objectives-controlled-excl-home": return mine.filter((o) => o.kind !== myHome).length;
    case "objectives-controlled-in-opponent-territory": return mine.filter((o) => o.territory === oppTerritory).length;
    case "more-objectives-than-opponent": return mine.length > theirs.length ? 1 : 0;
    case "central-controlled": return mine.some((o) => o.kind === "central") ? 1 : 0;
    case "opponent-home-controlled": return mine.some((o) => o.kind === oppHome) ? 1 : 0;
    case "own-home-controlled": return mine.some((o) => o.kind === myHome) ? 1 : 0;
  }
}

/**
 * Pre-fill selections for a block from the map. Players still confirm.
 * Non-per conditions are suggested when their tag evaluates to >= 1.
 * Exclusive blocks: keep the highest-VP qualifying option only.
 */
export function suggestSelections(block: ScoringBlock, seat: Seat, map: MapContext): Selection[] {
  const out: Selection[] = [];
  for (const c of block.conditions) {
    if (!c.auto) continue;
    const n = evaluateAuto(c.auto, seat, map);
    if (n < 1) continue;
    if (c.cumulativeOf) {
      const parent = out.find((s) => s.conditionId === c.cumulativeOf);
      if (!parent) continue;
      const cap = parent.count ?? 1;
      out.push(c.per ? { conditionId: c.id, count: Math.min(n, cap) } : { conditionId: c.id });
    } else {
      out.push(c.per ? { conditionId: c.id, count: n } : { conditionId: c.id });
    }
  }
  if (block.exclusive) {
    const base = out.filter((s) => !block.conditions.find((c) => c.id === s.conditionId)!.cumulativeOf);
    if (base.length > 1) {
      const vpOf = (s: Selection) => { const c = block.conditions.find((x) => x.id === s.conditionId)!; return c.vp * (s.count ?? 1); };
      const best = base.reduce((a, b) => (vpOf(b) > vpOf(a) ? b : a));
      return out.filter((s) => s === best || block.conditions.find((c) => c.id === s.conditionId)!.cumulativeOf);
    }
  }
  return out;
}
