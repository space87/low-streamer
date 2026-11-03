# Core rules engine (already built and tested)

Zero-dependency TypeScript, run directly by Node 22.18+ (`npm run test:engine`). Agents **extend** these modules; they must not rewrite them. Any behaviour change needs a failing test first.

| File | What it does |
|---|---|
| `shared/src/types.ts` | Rules data schema (cards, blocks, conditions, when-drawn rules, twists, deployments, caps), ledger and totals types |
| `server/src/rules/scoring.ts` | `scoreBlock` (per-count, exclusive, cumulative, per-score max), `applyCaps` (Fixed 20 → per-round 15 with end-of-battle exemption → total 45), `buildScoreEntry`, `buildAdjustment` (respects round and total caps both ways), `buildBattleReady`, `computeTotals`, `availableBlocks` (round windows, timings, round-5 override, modes) |
| `server/src/rules/deck.ts` | Tactical deck: crypto/seeded shuffle, `draw` with when-drawn rules (auto must-redraw, may-redraw prompts, Plunder/Cleanse pairing, notes), `resolveRedraw`, `achieve`, `discardForCp` (+1 CP once per own turn), `paidRedraw` (once per battle, 1 CP, Command phase), `manualAdd`, `publicDeckView` (no deck order) |
| `server/src/rules/mission.ts` | `resolvePrimaries` (5×5 matrix, Mirrored World, Scrambled Communications), `rollMirrored` |
| `server/src/rules/validate.ts` | `validateMissionData` — basis of `npm run data:check` |
| `server/src/rules/suggest.ts` | Map-assisted suggestions from objective control (`evaluateAuto`, `suggestSelections`) |
| `client/src/map/homography.ts` | Four-corner calibration: `computeHomography`, `applyHomography`, `cssMatrix3d`, `inchesToBoardPx` |
| `server/test/` | 31 tests incl. randomised invariant tests (cards conserved, CP ≥ 0, all caps hold, rounds never negative) |

## Bug found and fixed while building
Manual adjustments originally respected only the 45 VP total, so a +10 correction could push a round to 25 VP on the overlay. Adjustments now respect the per-round cap in both directions (regression test included).

## Notes for M0 integration
- Imports use explicit `.ts` extensions and only erasable TypeScript (no enums/namespaces/parameter properties), so they run under Node type stripping and compile under `tsc` with `allowImportingTsExtensions` + `noEmit` (or `rewriteRelativeImportExtensions` when emitting).
- Add zod schemas mirroring `shared/src/types.ts`; keep the TS types as the source of truth.
- Production must use `cryptoRng()`; `seededRng()` is for tests only.
