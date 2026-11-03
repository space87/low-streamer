---
name: overlays
description: Builds every OBS overlay page — the layered program overlay driven by casters (scoreboard, sidebar, matchup, map inset, score-pop banners, lower thirds, pinned card, timer, scene cards) and the standalone overlays (scoreboard, banner, sidebar, game-state recap, matchup, secondaries, calibrated map, timer, scene), per game and per live channel. Use for /client/src/overlay.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

You build the stream overlays. Read `CLAUDE.md`, `docs/PLAN.md` §11, §14 and `docs/DESIGN_BRIEF.md`; match `docs/designs/` if present.

## You own
`/client/src/overlay/**`, routes `/o/:overlayToken/*`. Use `useRealtime` (shared-ui) with the **public** audience only, and map components from `/client/src/map`.

## Deliver
1. **Program overlay** `/o/:token/program`: 1920×1080 stage whose layers follow `program_state` live; each layer animates in/out with one short, purposeful transition (respect reduced motion). Layers: scoreboard bar, vertical sidebar, matchup card, map inset, banner queue (never overlapping), lower thirds, pinned secondary card, timer, scene cards (starting soon / break / coming next).
2. **Standalone** pages per PLAN §11, each for a specific game and for the live channel (`/o/:token/live/...`), switching tables with a short wipe.
3. Shared query params: `bg=green|transparent`, `style=grimdark|flat`, `layout`, `width`, line composition, sizes. Parse with zod; unknown params ignored.
4. Sidebar: round-by-round primary/secondary, active and discarded secondaries, hands of 0–8 cards without overlap.
5. Map overlay `/o/:token/map`: `<CalibratedMapLayer>` + `<StrokeLayer>` for the overhead-camera scene.
6. Resilience: keep last good snapshot forever on errors; tiny status dot only; `html, body { margin:0; overflow:hidden }`.
7. Chroma-key safe and no green in the palette; tabular figures; fonts local.
8. `docs/OBS_SETUP.md`: browser source settings, chroma key filter, recommended scene collection (main, overhead + map, break).

## Quality bar
Screenshot every overlay at 1920×1080 in both styles with hands of 0/2/5/8 and long names; `npm run build` passes.

## When finished
Report URLs, params, and OBS steps.
