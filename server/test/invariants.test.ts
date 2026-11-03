// Randomised stress test: thousands of legal and illegal actions, checking invariants after each.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mini } from "./fixtures/mini-missions.ts";
import type { Card, LedgerEntry, Seat } from "../../shared/src/types.ts";
import { createDeck, draw, resolveRedraw, achieve, discardForCp, paidRedraw, seededRng, type DeckState } from "../src/rules/deck.ts";
import { buildScoreEntry, buildAdjustment, computeTotals, RulesError } from "../src/rules/scoring.ts";

const GAMES = Number(process.env.STRESS_GAMES ?? 300);
const cards = new Map<string, Card>(mini.secondaries.map((c) => [c.id, c]));
const allIds = mini.secondaries.map((c) => c.id).sort();

function checkDeck(s: DeckState) {
  const all = [...s.deck, ...s.hand.map((h) => h.cardId), ...s.discard, ...s.achieved].sort();
  assert.deepEqual(all, allIds, "every card exists exactly once");
  assert.ok(s.cp >= 0, "CP never negative");
}

function checkTotals(L: LedgerEntry[], seat: Seat, fixed: boolean) {
  const t = computeTotals(L, seat);
  const c = mini.caps;
  assert.ok(t.primary >= 0 && t.primary <= c.primaryTotal, `primary ${t.primary}`);
  assert.ok(t.secondary >= 0 && t.secondary <= c.secondaryTotal, `secondary ${t.secondary}`);
  for (let r = 0; r < 5; r++) {
    assert.ok(t.primaryByRound[r] >= 0 && t.secondaryByRound[r] >= 0, `round ${r + 1} negative`);
    assert.ok(t.primaryByRound[r] <= c.primaryPerRound, `primary round ${r + 1}: ${t.primaryByRound[r]}`);
    assert.ok(t.secondaryByRound[r] <= c.secondaryPerRound, `secondary round ${r + 1}: ${t.secondaryByRound[r]}`);
  }
  if (fixed) for (const s of mini.secondaries) assert.ok((t.byCard[s.id] ?? 0) <= c.fixedPerCard, `fixed card ${s.id}`);
  assert.equal(t.total, t.primary + t.secondary + t.battleReady);
}

test("deck engine invariants hold over many random games", () => {
  for (let g = 0; g < GAMES; g++) {
    const rng = seededRng(1000 + g);
    let s = createDeck(mini.secondaries, rng, 2);
    for (let round = 1; round <= 5; round++) {
      for (const active of ["A", "B"] as Seat[]) {
        const mine = active === "A";
        try {
          if (mine) {
            const d = draw(s, 2, cards, round, rng); s = d.state;
            for (const p of d.prompts) if (p.type === "may-redraw" && rng() < 0.5 && s.hand.some((h) => h.cardId === p.cardId)) {
              s = resolveRedraw(s, p.cardId, p.shuffleBack, cards, round, rng).state;
            }
            if (s.hand.length && rng() < 0.3) s = paidRedraw(s, s.hand[0].cardId, { round, phase: "command", activeSeat: "A", seat: "A" }, cards, rng).state;
          }
          if (s.hand.length && rng() < 0.4) s = achieve(s, s.hand[Math.floor(rng() * s.hand.length)].cardId);
          if (s.hand.length && rng() < 0.3) {
            s = discardForCp(s, [s.hand[0].cardId], { round, phase: "turn-end", activeSeat: active, seat: "A" });
          }
        } catch (e) {
          assert.ok(e instanceof RulesError, `unexpected error type: ${e}`);
        }
        checkDeck(s);
      }
    }
  }
});

test("scoring caps hold over many random games with random adjustments", () => {
  const scorable = [...mini.primaries, ...mini.secondaries];
  for (let g = 0; g < GAMES; g++) {
    const rng = seededRng(5000 + g);
    const L: LedgerEntry[] = [];
    const modes = { A: rng() < 0.5 ? "fixed" : "tactical", B: rng() < 0.5 ? "fixed" : "tactical" } as const;
    let id = 0;
    for (let i = 0; i < 80; i++) {
      const seat: Seat = rng() < 0.5 ? "A" : "B";
      const round = 1 + Math.floor(rng() * 5);
      try {
        if (rng() < 0.1) {
          L.push(buildAdjustment(L, mini.caps, { id: `x${id++}`, seat, round, target: rng() < 0.5 ? "primary" : "secondary", vp: (Math.floor(rng() * 10) + 1) * (rng() < 0.5 ? -1 : 1), note: "fuzz", actor: "t", now: 0 }));
          continue;
        }
        const card = scorable[Math.floor(rng() * scorable.length)];
        const block = card.blocks[Math.floor(rng() * card.blocks.length)];
        const sels = [];
        for (const c of block.conditions) {
          if (rng() < 0.6) sels.push(c.per ? { conditionId: c.id, count: 1 + Math.floor(rng() * 6) } : { conditionId: c.id });
        }
        const e = buildScoreEntry(L, mini.caps, { id: `s${id++}`, seat, round, card, blockId: block.id, selections: sels, secondaryMode: modes[seat], actor: "t", now: 0 });
        assert.ok(e.awardedVp >= 0 && e.awardedVp <= e.rawVp, "awarded within [0, raw]");
        L.push(e);
      } catch (e) {
        assert.ok(e instanceof RulesError, `unexpected error type: ${e}`);
      }
      checkTotals(L, "A", modes.A === "fixed");
      checkTotals(L, "B", modes.B === "fixed");
    }
  }
});
