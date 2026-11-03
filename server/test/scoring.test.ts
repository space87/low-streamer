import { test } from "node:test";
import assert from "node:assert/strict";
import { mini } from "./fixtures/mini-missions.ts";
import type { LedgerEntry, Seat } from "../../shared/src/types.ts";
import {
  scoreBlock, buildScoreEntry, buildAdjustment, buildBattleReady, computeTotals, availableBlocks, RulesError,
} from "../src/rules/scoring.ts";
import { resolvePrimaries, rollMirrored } from "../src/rules/mission.ts";
import { validateMissionData } from "../src/rules/validate.ts";
import { suggestSelections, evaluateAuto, type MapContext } from "../src/rules/suggest.ts";

const card = (id: string) => [...mini.primaries, ...mini.secondaries].find((c) => c.id === id)!;
const block = (cid: string, bid: string) => card(cid).blocks.find((b) => b.id === bid)!;
let n = 0;
const score = (ledger: LedgerEntry[], seat: Seat, round: number, cid: string, bid: string, selections: any[], mode?: any) => {
  const e = buildScoreEntry(ledger, mini.caps, { id: `e${n++}`, seat, round, card: card(cid), blockId: bid, selections, secondaryMode: mode, actor: "t", now: 0 });
  ledger.push(e);
  return e;
};

test("per-count and cumulative conditions", () => {
  const r = scoreBlock(block("battlefield-dominance", "hold"), [{ conditionId: "each", count: 3 }, { conditionId: "home-bonus", count: 2 }]);
  assert.equal(r.rawVp, 3 * 3 + 2 * 2);
});

test("cumulative cannot exceed parent count or exist without parent", () => {
  const b = block("battlefield-dominance", "hold");
  assert.throws(() => scoreBlock(b, [{ conditionId: "each", count: 1 }, { conditionId: "home-bonus", count: 2 }]), /can't exceed/);
  assert.throws(() => scoreBlock(b, [{ conditionId: "home-bonus", count: 1 }]), /main condition/);
});

test("exclusive blocks allow only one option", () => {
  assert.throws(() => scoreBlock(block("cleanse", "s"), [{ conditionId: "one" }, { conditionId: "two" }]), RulesError);
  assert.equal(scoreBlock(block("cleanse", "s"), [{ conditionId: "two" }]).rawVp, 5);
});

test("per-score maximum ('up to 5VP')", () => {
  const r = scoreBlock(block("no-prisoners", "s"), [{ conditionId: "each", count: 4 }]);
  assert.equal(r.rawVp, 5);
  assert.equal(r.perScoreCapped, true);
});

test("per-count needs a positive integer; flat conditions reject counts", () => {
  assert.throws(() => scoreBlock(block("no-prisoners", "s"), [{ conditionId: "each" }]), /how many/);
  assert.throws(() => scoreBlock(block("meatgrinder", "kill"), [{ conditionId: "destroyed", count: 3 }]), /not a per-count/);
});

test("primary per-round cap 15", () => {
  const L: LedgerEntry[] = [];
  score(L, "A", 2, "battlefield-dominance", "hold", [{ conditionId: "each", count: 4 }]); // 12
  const e = score(L, "A", 2, "battlefield-dominance", "hold", [{ conditionId: "each", count: 2 }]); // 6 -> 3
  assert.equal(e.awardedVp, 3);
  assert.deepEqual(e.cappedBy, ["per-round"]);
  assert.equal(computeTotals(L, "A").primaryByRound[1], 15);
});

test("primary total cap 45 and end-of-battle exempt from round cap", () => {
  const L: LedgerEntry[] = [];
  for (const r of [2, 3, 4]) score(L, "A", r, "unstoppable-force", "hold", [{ conditionId: "each", count: 3 }]); // 12 x3 = 36
  score(L, "A", 5, "unstoppable-force", "hold", [{ conditionId: "each", count: 3 }]); // 12 -> total 48? capped to 9
  assert.equal(computeTotals(L, "A").primary, 45);
  const L2: LedgerEntry[] = [];
  score(L2, "B", 5, "unstoppable-force", "hold", [{ conditionId: "each", count: 3 }]); // 12 in round 5
  score(L2, "B", 5, "unstoppable-force", "kill", [{ conditionId: "destroyed" }]); // 3 -> 15
  const eob = score(L2, "B", 5, "unstoppable-force", "end", [{ conditionId: "central" }]); // exempt
  assert.equal(eob.awardedVp, 5);
  assert.equal(eob.endOfBattle, true);
  const t = computeTotals(L2, "B");
  assert.equal(t.primary, 20);
  assert.equal(t.primaryByRound[5], 5);
});

test("fixed secondary capped at 20 per card; seats are independent", () => {
  const L: LedgerEntry[] = [];
  for (let r = 1; r <= 5; r++) score(L, "A", r, "assassination", "fixed", [{ conditionId: "each", count: 2 }, { conditionId: "tough", count: 1 }], "fixed"); // 7 each
  const t = computeTotals(L, "A");
  assert.equal(t.byCard["assassination"], 20);
  assert.equal(computeTotals(L, "B").total, 0);
});

test("secondary per-round 15 and total 45", () => {
  const L: LedgerEntry[] = [];
  for (let r = 1; r <= 5; r++) {
    for (let i = 0; i < 4; i++) score(L, "A", r, "no-prisoners", "s", [{ conditionId: "each", count: 3 }], "tactical"); // 5 each, 20 attempted per round
  }
  const t = computeTotals(L, "A");
  assert.deepEqual(t.secondaryByRound.slice(0, 5), [15, 15, 15, 0, 0]);
  assert.equal(t.secondary, 45);
});

test("mode guard: fixed blocks not usable in tactical, manual counts as tactical", () => {
  const L: LedgerEntry[] = [];
  assert.throws(() => score(L, "A", 1, "assassination", "fixed", [{ conditionId: "each", count: 1 }], "tactical"), /fixed missions only/);
  assert.equal(score(L, "A", 1, "assassination", "tactical", [{ conditionId: "any" }], "manual").awardedVp, 5);
});

test("adjustments need a reason and stay within [0, cap]", () => {
  const L: LedgerEntry[] = [];
  score(L, "A", 2, "battlefield-dominance", "hold", [{ conditionId: "each", count: 2 }]); // 6
  assert.throws(() => buildAdjustment(L, mini.caps, { id: "a", seat: "A", round: 2, target: "primary", vp: -2, note: " ", actor: "t", now: 0 }));
  const adj = buildAdjustment(L, mini.caps, { id: "a", seat: "A", round: 2, target: "primary", vp: -10, note: "mis-tap", actor: "t", now: 0 });
  assert.equal(adj.awardedVp, -6);
  L.push(adj);
  assert.equal(computeTotals(L, "A").primary, 0);
  // a positive adjustment can't push a round past 15
  const L2: LedgerEntry[] = [];
  score(L2, "A", 3, "battlefield-dominance", "hold", [{ conditionId: "each", count: 4 }]); // 12
  const up = buildAdjustment(L2, mini.caps, { id: "b", seat: "A", round: 3, target: "primary", vp: 10, note: "missed score", actor: "t", now: 0 });
  assert.equal(up.awardedVp, 3);
  assert.deepEqual(up.cappedBy, ["per-round"]);
});

test("battle ready once, adds 10 to total", () => {
  const L: LedgerEntry[] = [];
  L.push(buildBattleReady(L, mini.caps, { id: "br", seat: "B", actor: "t", now: 0 }));
  assert.throws(() => buildBattleReady(L, mini.caps, { id: "br2", seat: "B", actor: "t", now: 0 }));
  assert.equal(computeTotals(L, "B").total, 10);
});

test("availability: round windows, timings and round-5 override", () => {
  const bd = card("battlefield-dominance");
  assert.deepEqual(availableBlocks(bd, "A", { round: 1, phase: "turn-end", activeSeat: "A", battleEnded: false }), ["early"]);
  assert.deepEqual(availableBlocks(bd, "A", { round: 2, phase: "command", activeSeat: "A", battleEnded: false }), ["hold"]);
  assert.deepEqual(availableBlocks(bd, "A", { round: 2, phase: "command", activeSeat: "B", battleEnded: false }), []);
  assert.deepEqual(availableBlocks(bd, "A", { round: 5, phase: "command", activeSeat: "A", battleEnded: false }), []);
  assert.deepEqual(availableBlocks(bd, "A", { round: 5, phase: "turn-end", activeSeat: "A", battleEnded: false }), ["hold"]);
  const ds = card("defend-stronghold");
  assert.deepEqual(availableBlocks(ds, "A", { round: 2, phase: "turn-end", activeSeat: "B", battleEnded: false }), ["s"]);
  assert.deepEqual(availableBlocks(card("unstoppable-force"), "A", { round: 5, phase: "turn-end", activeSeat: "A", battleEnded: true }), ["end"]);
  const ass = card("assassination");
  assert.deepEqual(availableBlocks(ass, "B", { round: 3, phase: "turn-end", activeSeat: "A", battleEnded: false }, "fixed"), ["fixed"]);
});

test("primaries from the matrix, mirrors, and twists", () => {
  assert.deepEqual(resolvePrimaries(mini, { A: "take-and-hold", B: "purge-the-foe" }), { A: "immovable-object", B: "unstoppable-force" });
  assert.deepEqual(resolvePrimaries(mini, { A: "purge-the-foe", B: "purge-the-foe" }), { A: "meatgrinder", B: "meatgrinder" });
  assert.deepEqual(resolvePrimaries(mini, { A: "take-and-hold", B: "purge-the-foe" }, { id: "scrambled-communications" }), { A: "unstoppable-force", B: "immovable-object" });
  assert.deepEqual(resolvePrimaries(mini, { A: "take-and-hold", B: "purge-the-foe" }, { id: "mirrored-world", mirroredPrimaryId: "meatgrinder" }), { A: "meatgrinder", B: "meatgrinder" });
  assert.throws(() => resolvePrimaries(mini, { A: "take-and-hold", B: "purge-the-foe" }, { id: "mirrored-world" }));
  const rolls = [6, 6, 2];
  assert.equal(rollMirrored(["x", "y", "z", "w", "v"], () => rolls.shift()!), "y");
});

test("fixture passes validation; broken data is caught", () => {
  assert.deepEqual(validateMissionData(mini, { requireComplete: false }), []);
  assert.ok(validateMissionData(mini, { requireComplete: true }).some((e) => /Expected 5 dispositions/.test(e)));
  const broken = structuredClone(mini);
  broken.matrix["take-and-hold"]!["take-and-hold"] = "nope";
  broken.secondaries[0].blocks[0].conditions[0].label = "this label is far too long to be a short paraphrase of any card text at all";
  broken.secondaries[1].fixedEligible = false;
  const errs = validateMissionData(broken, { requireComplete: false });
  assert.ok(errs.some((e) => /missing primary nope/.test(e)));
  assert.ok(errs.some((e) => /over 12 words/.test(e)));
  assert.ok(errs.some((e) => /fixed blocks on a non-fixed card/.test(e)));
});

test("map suggestions", () => {
  const map: MapContext = {
    attackerSeat: "A",
    objectives: [
      { id: "ha", kind: "home-attacker", territory: "attacker", controlledBy: "A" },
      { id: "hd", kind: "home-defender", territory: "defender", controlledBy: "A" },
      { id: "ea", kind: "expansion", territory: "attacker", controlledBy: "A" },
      { id: "ed", kind: "expansion", territory: "defender", controlledBy: "B" },
      { id: "c", kind: "central", territory: "none", controlledBy: "contested" },
    ],
  };
  assert.equal(evaluateAuto("objectives-controlled", "A", map), 3);
  assert.equal(evaluateAuto("objectives-controlled-excl-home", "A", map), 2);
  assert.equal(evaluateAuto("objectives-controlled-in-opponent-territory", "A", map), 1);
  assert.equal(evaluateAuto("opponent-home-controlled", "A", map), 1);
  assert.equal(evaluateAuto("central-controlled", "A", map), 0);
  assert.equal(evaluateAuto("own-home-controlled", "B", map), 0);
  assert.deepEqual(suggestSelections(block("battlefield-dominance", "hold"), "A", map), [{ conditionId: "each", count: 3 }]);
  assert.deepEqual(suggestSelections(block("meatgrinder", "late"), "A", map), [{ conditionId: "home" }]);
  assert.deepEqual(suggestSelections(block("meatgrinder", "late"), "B", map), []);
});
