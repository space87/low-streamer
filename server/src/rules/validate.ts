import type { Card, MissionData } from "../../../shared/src/types.ts";

/** Integrity checks behind `npm run data:check`. Returns human-readable problems (empty = OK). */
export function validateMissionData(data: MissionData, opts: { requireComplete: boolean }): string[] {
  const errs: string[] = [];
  const primaries = new Map(data.primaries.map((c) => [c.id, c]));
  const secondaries = new Map(data.secondaries.map((c) => [c.id, c]));
  const dispIds = data.dispositions.map((d) => d.id);

  const dupes = (cards: Card[]) => cards.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
  for (const d of [...dupes(data.primaries), ...dupes(data.secondaries)]) errs.push(`Duplicate card id ${d}`);

  if (opts.requireComplete) {
    if (dispIds.length !== 5) errs.push(`Expected 5 dispositions, found ${dispIds.length}`);
    for (const a of dispIds) for (const b of dispIds) {
      if (!data.matrix[a]?.[b]) errs.push(`Matrix missing ${a} vs ${b}`);
    }
    if (data.primaries.length !== 25) errs.push(`Expected 25 primaries, found ${data.primaries.length}`);
  }
  for (const [a, row] of Object.entries(data.matrix)) {
    for (const [b, id] of Object.entries(row ?? {})) {
      if (id && !primaries.has(id)) errs.push(`Matrix ${a} vs ${b} points at missing primary ${id}`);
    }
  }

  const checkCard = (c: Card) => {
    if (c.blocks.length === 0) errs.push(`${c.id}: no scoring blocks`);
    const blockIds = new Set<string>();
    for (const b of c.blocks) {
      if (blockIds.has(b.id)) errs.push(`${c.id}: duplicate block ${b.id}`);
      blockIds.add(b.id);
      if (b.rounds !== "end-of-battle" && (b.rounds.from < 1 || b.rounds.to > 5 || b.rounds.from > b.rounds.to)) {
        errs.push(`${c.id}/${b.id}: bad round window`);
      }
      const condIds = new Set(b.conditions.map((x) => x.id));
      if (condIds.size !== b.conditions.length) errs.push(`${c.id}/${b.id}: duplicate condition ids`);
      for (const cond of b.conditions) {
        if (cond.vp <= 0) errs.push(`${c.id}/${b.id}/${cond.id}: vp must be positive`);
        if (cond.label.split(/\s+/).length > 12) errs.push(`${c.id}/${b.id}/${cond.id}: label over 12 words (paraphrase it)`);
        if (cond.cumulativeOf && !condIds.has(cond.cumulativeOf)) errs.push(`${c.id}/${b.id}/${cond.id}: missing cumulative parent`);
      }
      if (b.mode && c.kind === "primary") errs.push(`${c.id}/${b.id}: primaries cannot have fixed/tactical modes`);
    }
    for (const r of c.whenDrawn ?? []) {
      if (r.type === "may-redraw-if-active" && !secondaries.has(r.otherCardId)) {
        errs.push(`${c.id}: when-drawn references missing card ${r.otherCardId}`);
      }
    }
  };
  data.primaries.forEach(checkCard);
  data.secondaries.forEach(checkCard);

  for (const s of data.secondaries) {
    if (s.fixedEligible && !s.blocks.some((b) => !b.mode || b.mode === "fixed")) {
      errs.push(`${s.id}: fixed-eligible but has no blocks usable in fixed mode`);
    }
    if (!s.fixedEligible && s.blocks.some((b) => b.mode === "fixed")) errs.push(`${s.id}: fixed blocks on a non-fixed card`);
  }
  for (const t of data.twists) {
    for (const id of t.mirroredOptions ?? []) if (!primaries.has(id)) errs.push(`Twist ${t.id}: unknown primary ${id}`);
  }
  for (const d of data.deployments) {
    for (const o of d.objectives) {
      if (o.x < 0 || o.y < 0 || o.x > d.board.widthIn || o.y > d.board.depthIn) errs.push(`${d.id}/${o.id}: objective off the board`);
    }
  }
  return errs;
}
