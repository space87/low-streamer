// Test fixture: a small subset of 11th edition missions.
// Labels are short paraphrases (not card text). Board geometry is INVENTED for tests only.
import type { MissionData } from "../../../shared/src/types.ts";

const allRounds = { from: 1, to: 5 };
const r2on = { from: 2, to: 5 };

export const mini: MissionData = {
  version: "fixture-1",
  source: "test fixture (paraphrased)",
  lastVerified: "2026-11-03",
  dispositions: [
    { id: "take-and-hold", name: "Take and Hold" },
    { id: "purge-the-foe", name: "Purge the Foe" },
  ],
  matrix: {
    "take-and-hold": { "take-and-hold": "battlefield-dominance", "purge-the-foe": "immovable-object" },
    "purge-the-foe": { "take-and-hold": "unstoppable-force", "purge-the-foe": "meatgrinder" },
  },
  primaries: [
    {
      id: "battlefield-dominance", name: "Battlefield Dominance", kind: "primary",
      blocks: [
        { id: "early", rounds: { from: 1, to: 2 }, timing: "end-own-turn",
          conditions: [{ id: "more", label: "Hold more objectives than opponent", vp: 2, auto: "more-objectives-than-opponent" }] },
        { id: "hold", rounds: r2on, timing: "end-own-command", round5Timing: "end-own-turn",
          conditions: [
            { id: "each", label: "Each objective you hold", vp: 3, per: true, auto: "objectives-controlled" },
            { id: "home-bonus", label: "Each non-home held while holding your home", vp: 2, per: true, cumulativeOf: "each" },
          ] },
      ],
    },
    {
      id: "immovable-object", name: "Immovable Object", kind: "primary",
      blocks: [
        { id: "centre", rounds: allRounds, timing: "end-own-turn",
          conditions: [{ id: "central", label: "Hold a central objective", vp: 3, auto: "central-controlled" }] },
        { id: "mid", rounds: { from: 2, to: 4 }, timing: "end-own-command",
          conditions: [{ id: "each", label: "Each non-home objective held", vp: 5, per: true, auto: "objectives-controlled-excl-home" }] },
        { id: "last", rounds: { from: 5, to: 5 }, timing: "end-own-turn",
          conditions: [{ id: "each", label: "Each non-home objective held", vp: 5, per: true, auto: "objectives-controlled-excl-home" }] },
      ],
    },
    {
      id: "unstoppable-force", name: "Unstoppable Force", kind: "primary",
      blocks: [
        { id: "kill", rounds: allRounds, timing: "end-own-turn",
          conditions: [{ id: "destroyed", label: "Destroyed an enemy unit this turn", vp: 3 }] },
        { id: "hold", rounds: r2on, timing: "end-own-command", round5Timing: "end-own-turn",
          conditions: [{ id: "each", label: "Each non-home objective held", vp: 4, per: true, auto: "objectives-controlled-excl-home" }] },
        { id: "take", rounds: r2on, timing: "end-own-turn",
          conditions: [{ id: "new", label: "Took a non-home objective this turn", vp: 3 }] },
        { id: "end", rounds: "end-of-battle", timing: "end-own-turn",
          conditions: [{ id: "central", label: "Hold a central objective", vp: 5, auto: "central-controlled" }] },
      ],
    },
    {
      id: "meatgrinder", name: "Meatgrinder", kind: "primary",
      blocks: [
        { id: "kill", rounds: allRounds, timing: "end-own-turn",
          conditions: [{ id: "destroyed", label: "Destroyed an enemy unit this turn", vp: 3 }] },
        { id: "hold", rounds: r2on, timing: "end-own-command", round5Timing: "end-own-turn",
          conditions: [{ id: "any", label: "Hold a non-home objective", vp: 4, auto: "objectives-controlled-excl-home" }] },
        { id: "late", rounds: r2on, timing: "end-own-turn",
          conditions: [
            { id: "outkill", label: "Killed more than you lost last turn", vp: 5 },
            { id: "home", label: "Hold opponent's home objective", vp: 5, auto: "opponent-home-controlled" },
          ] },
      ],
    },
  ],
  secondaries: [
    { id: "no-prisoners", name: "No Prisoners", kind: "secondary",
      blocks: [{ id: "s", rounds: allRounds, timing: "end-any-turn",
        conditions: [{ id: "each", label: "Each enemy unit destroyed", vp: 2, per: true, maxVpPerScore: 5 }] }] },
    { id: "assassination", name: "Assassination", kind: "secondary", fixedEligible: true,
      blocks: [
        { id: "fixed", rounds: allRounds, timing: "end-any-turn", mode: "fixed",
          conditions: [
            { id: "each", label: "Each enemy character model destroyed", vp: 3, per: true },
            { id: "tough", label: "Each of those with 4+ wounds", vp: 1, per: true, cumulativeOf: "each" },
          ] },
        { id: "tactical", rounds: allRounds, timing: "end-any-turn", mode: "tactical",
          conditions: [{ id: "any", label: "A character died, or all are gone", vp: 5 }] },
      ] },
    { id: "bring-it-down", name: "Bring It Down", kind: "secondary", fixedEligible: true,
      whenDrawn: [{ type: "may-redraw-if-condition", prompt: "No enemy models with 10+ wounds on the table", shuffleBack: false }],
      blocks: [
        { id: "fixed", rounds: allRounds, timing: "end-any-turn", mode: "fixed",
          conditions: [{ id: "each", label: "Each 10+ wound model destroyed", vp: 4, per: true, maxVpPerScore: 5 }] },
        { id: "tactical", rounds: allRounds, timing: "end-any-turn", mode: "tactical",
          conditions: [{ id: "each", label: "Each 10+ wound model destroyed", vp: 5, per: true, maxVpPerScore: 5 }] },
      ] },
    { id: "engage-on-all-fronts", name: "Engage on All Fronts", kind: "secondary", fixedEligible: true,
      blocks: [
        { id: "fixed", rounds: allRounds, timing: "end-own-turn", mode: "fixed", exclusive: true,
          conditions: [{ id: "three", label: "Presence in three table quarters", vp: 2 }, { id: "four", label: "Presence in four table quarters", vp: 4 }] },
        { id: "tactical", rounds: allRounds, timing: "end-own-turn", mode: "tactical", exclusive: true,
          conditions: [{ id: "three", label: "Presence in three table quarters", vp: 3 }, { id: "four", label: "Presence in four table quarters", vp: 5 }] },
      ] },
    { id: "forward-position", name: "Forward Position", kind: "secondary",
      whenDrawn: [{ type: "may-redraw-if-round", round: 1, shuffleBack: true }],
      blocks: [{ id: "s", rounds: allRounds, timing: "end-own-turn",
        conditions: [{ id: "held", label: "Hold enemy home and/or every expansion", vp: 5 }] }] },
    { id: "defend-stronghold", name: "Defend Stronghold", kind: "secondary",
      whenDrawn: [{ type: "must-redraw-if-round", round: 1, shuffleBack: true }],
      blocks: [{ id: "s", rounds: r2on, timing: "end-opponent-turn",
        conditions: [
          { id: "home", label: "Hold your home objective", vp: 3, auto: "own-home-controlled" },
          { id: "clear", label: "No enemies in your deployment zone", vp: 2, cumulativeOf: "home" },
        ] }] },
    { id: "plunder", name: "Plunder", kind: "secondary",
      whenDrawn: [{ type: "may-redraw-if-active", otherCardId: "cleanse", shuffleBack: true }],
      blocks: [{ id: "s", rounds: allRounds, timing: "end-own-turn",
        conditions: [{ id: "done", label: "A terrain area was plundered this turn", vp: 5 }] }] },
    { id: "cleanse", name: "Cleanse", kind: "secondary",
      whenDrawn: [{ type: "may-redraw-if-active", otherCardId: "plunder", shuffleBack: true }],
      blocks: [{ id: "s", rounds: allRounds, timing: "end-own-turn", exclusive: true,
        conditions: [{ id: "one", label: "One objective cleansed this turn", vp: 2 }, { id: "two", label: "Two or more objectives cleansed", vp: 5 }] }] },
  ],
  twists: [
    { id: "none", name: "No twist", effect: "none" },
    { id: "mirrored-world", name: "Mirrored World", effect: "mirrored-world", mirroredOptions: ["battlefield-dominance", "meatgrinder"] },
    { id: "scrambled-communications", name: "Scrambled Communications", effect: "scrambled-communications" },
  ],
  deployments: [{
    id: "test-board", name: "Test board (invented)", board: { widthIn: 60, depthIn: 44 },
    objectives: [
      { id: "ha", kind: "home-attacker", x: 30, y: 6, territory: "attacker" },
      { id: "hd", kind: "home-defender", x: 30, y: 38, territory: "defender" },
      { id: "ea", kind: "expansion", x: 10, y: 16, territory: "attacker" },
      { id: "ed", kind: "expansion", x: 50, y: 28, territory: "defender" },
      { id: "c", kind: "central", x: 30, y: 22, territory: "none" },
    ],
  }],
  caps: {
    primaryTotal: 45, primaryPerRound: 15, secondaryTotal: 45, secondaryPerRound: 15,
    fixedPerCard: 20, battleReady: 10, endOfBattleExemptFromRoundCap: true,
  },
};
