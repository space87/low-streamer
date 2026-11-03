import { test } from "node:test";
import assert from "node:assert/strict";
import { mini } from "./fixtures/mini-missions.ts";
import type { Card } from "../../shared/src/types.ts";
import {
  createDeck, draw, resolveRedraw, achieve, discardForCp, paidRedraw, manualAdd, publicDeckView, seededRng, cryptoRng, shuffle, type DeckState,
} from "../src/rules/deck.ts";
import { computeHomography, applyHomography, cssMatrix3d, inchesToBoardPx } from "../../client/src/map/homography.ts";

const cards = new Map<string, Card>(mini.secondaries.map((c) => [c.id, c]));
const own = (round: number, phase: any) => ({ round, phase, activeSeat: "A" as const, seat: "A" as const });
const withTop = (top: string[], extra: Partial<DeckState> = {}): DeckState => ({
  deck: [...top, ...mini.secondaries.map((c) => c.id).filter((id) => !top.includes(id))],
  hand: [], discard: [], achieved: [], usedPaidRedraw: false, cp: 0, ...extra,
});

test("shuffle is a permutation and deterministic with a seed", () => {
  const ids = mini.secondaries.map((c) => c.id);
  const a = shuffle(ids, seededRng(42));
  assert.deepEqual([...a].sort(), [...ids].sort());
  assert.deepEqual(a, shuffle(ids, seededRng(42)));
  const d = createDeck(mini.secondaries, cryptoRng());
  assert.equal(d.deck.length, ids.length);
});

test("draw 2 per command phase, no hand limit, no duplicates", () => {
  let s = createDeck(mini.secondaries, seededRng(1));
  const seen = new Set<string>();
  for (let r = 2; r <= 4; r++) {
    const res = draw(s, 2, cards, r, seededRng(r));
    s = res.state;
    res.drawn.forEach((id) => { assert.ok(!seen.has(id)); seen.add(id); });
  }
  assert.equal(s.hand.length, 6);
  assert.equal(s.deck.length, mini.secondaries.length - 6);
});

test("must-redraw in round 1 shuffles the card back automatically", () => {
  const res = draw(withTop(["defend-stronghold", "no-prisoners", "plunder"]), 2, cards, 1, seededRng(3));
  assert.ok(!res.drawn.includes("defend-stronghold"));
  assert.equal(res.drawn.length, 2);
  assert.ok(res.state.deck.includes("defend-stronghold"));
  // Not round 1: it stays
  const res2 = draw(withTop(["defend-stronghold"]), 1, cards, 2, seededRng(3));
  assert.deepEqual(res2.drawn, ["defend-stronghold"]);
});

test("may-redraw prompts: round 1, condition, and the Plunder/Cleanse pair", () => {
  const r1 = draw(withTop(["forward-position"]), 1, cards, 1, seededRng(1));
  assert.deepEqual(r1.prompts.map((p) => p.type), ["may-redraw"]);
  assert.equal(draw(withTop(["forward-position"]), 1, cards, 2, seededRng(1)).prompts.length, 0);
  const bid = draw(withTop(["bring-it-down"]), 1, cards, 3, seededRng(1));
  assert.equal(bid.prompts[0].type === "may-redraw" && bid.prompts[0].shuffleBack, false);
  const pair = draw(withTop(["cleanse", "plunder"]), 2, cards, 2, seededRng(1));
  assert.deepEqual(pair.prompts.map((p) => p.cardId), ["plunder"]);
});

test("resolveRedraw: shuffle back vs discard, then draws a replacement", () => {
  let s = draw(withTop(["forward-position", "no-prisoners"]), 1, cards, 1, seededRng(1)).state;
  const back = resolveRedraw(s, "forward-position", true, cards, 1, seededRng(9));
  assert.equal(back.state.hand.length, 1);
  assert.ok(!back.state.hand.some((h) => h.cardId === "forward-position"));
  const all = [...back.state.deck, ...back.state.hand.map((h) => h.cardId), ...back.state.discard, ...back.state.achieved];
  assert.equal(all.filter((id) => id === "forward-position").length, 1, "card conserved exactly once");
  assert.deepEqual([...all].sort(), mini.secondaries.map((c) => c.id).sort());
  s = draw(withTop(["bring-it-down"]), 1, cards, 3, seededRng(1)).state;
  const dis = resolveRedraw(s, "bring-it-down", false, cards, 3, seededRng(1));
  assert.deepEqual(dis.state.discard, ["bring-it-down"]);
  assert.ok(!dis.state.deck.includes("bring-it-down"));
});

test("achieve removes from hand", () => {
  const s = draw(withTop(["no-prisoners"]), 1, cards, 2, seededRng(1)).state;
  const a = achieve(s, "no-prisoners");
  assert.deepEqual(a.achieved, ["no-prisoners"]);
  assert.equal(a.hand.length, 0);
  assert.throws(() => achieve(a, "no-prisoners"), /not in your hand/);
});

test("discard for CP: own turn end only, +1 CP once per turn regardless of count", () => {
  const s = draw(withTop(["no-prisoners", "plunder", "cleanse"]), 3, cards, 2, seededRng(1)).state;
  assert.throws(() => discardForCp(s, ["plunder"], own(2, "main")), /end of your own turn/);
  assert.throws(() => discardForCp(s, ["plunder"], { round: 2, phase: "turn-end", activeSeat: "B", seat: "A" }));
  const d = discardForCp(s, ["plunder", "cleanse"], own(2, "turn-end"));
  assert.equal(d.cp, 1);
  assert.deepEqual(d.discard, ["plunder", "cleanse"]);
  assert.throws(() => discardForCp(d, ["no-prisoners"], own(2, "turn-end")), /Already/);
  assert.equal(discardForCp(d, ["no-prisoners"], own(3, "turn-end")).cp, 2);
});

test("paid redraw: once per battle, costs 1 CP, command phase only", () => {
  const s = draw(withTop(["plunder", "no-prisoners", "cleanse"]), 1, cards, 2, seededRng(1)).state;
  assert.throws(() => paidRedraw(s, "plunder", own(2, "command"), cards, seededRng(1)), /Not enough CP/);
  const rich = { ...s, cp: 2 };
  assert.throws(() => paidRedraw(rich, "plunder", own(2, "main"), cards, seededRng(1)), /Command phase/);
  const r = paidRedraw(rich, "plunder", own(2, "command"), cards, seededRng(1));
  assert.equal(r.state.cp, 1);
  assert.equal(r.state.usedPaidRedraw, true);
  assert.deepEqual(r.state.discard, ["plunder"]);
  assert.equal(r.state.hand.length, 1);
  assert.throws(() => paidRedraw(r.state, r.state.hand[0].cardId, own(3, "command"), cards, seededRng(1)), /already been used/);
});

test("empty deck draws nothing and reports it", () => {
  const s: DeckState = { deck: ["no-prisoners"], hand: [], discard: [], achieved: [], usedPaidRedraw: false, cp: 0 };
  const r = draw(s, 2, cards, 3, seededRng(1));
  assert.deepEqual(r.drawn, ["no-prisoners"]);
  assert.equal(r.deckEmpty, true);
});

test("manual mode adds a named card once", () => {
  const s = createDeck(mini.secondaries, seededRng(1));
  const m = manualAdd(s, "plunder", 2);
  assert.deepEqual(m.hand, [{ cardId: "plunder", drawnRound: 2 }]);
  assert.throws(() => manualAdd(m, "plunder", 3), /already/);
});

test("public view never exposes deck order", () => {
  const v = publicDeckView(createDeck(mini.secondaries, seededRng(1)));
  assert.equal("deck" in v, false);
  assert.equal(v.deckCount, mini.secondaries.length);
});

test("homography round-trips corners and interior points", () => {
  const src = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 440 }, { x: 0, y: 440 }];
  const dst = [{ x: 212, y: 95 }, { x: 1690, y: 120 }, { x: 1820, y: 1010 }, { x: 105, y: 980 }];
  const h = computeHomography(src, dst);
  for (let i = 0; i < 4; i++) {
    const p = applyHomography(h, src[i]);
    assert.ok(Math.hypot(p.x - dst[i].x, p.y - dst[i].y) < 0.5);
  }
  const inv = computeHomography(dst, src);
  const mid = applyHomography(inv, applyHomography(h, { x: 300, y: 220 }));
  assert.ok(Math.hypot(mid.x - 300, mid.y - 220) < 0.5);
  assert.match(cssMatrix3d(600, 440, dst as any), /^matrix3d\(([-\d.e]+,){15}[-\d.e]+\)$/);
  assert.throws(() => computeHomography(src, [dst[0], dst[0], dst[0], dst[0]]), /Degenerate/);
});

test("inches to board pixels flips y (inches measured from the bottom edge)", () => {
  assert.deepEqual(inchesToBoardPx({ x: 30, y: 22 }, { widthIn: 60, depthIn: 44 }, { width: 600, height: 440 }), { x: 300, y: 220 });
  assert.deepEqual(inchesToBoardPx({ x: 0, y: 0 }, { widthIn: 60, depthIn: 44 }, { width: 600, height: 440 }), { x: 0, y: 440 });
});
