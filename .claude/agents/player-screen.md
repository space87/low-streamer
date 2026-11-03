---
name: player-screen
description: Builds the player screen of the web app — table link + code entry, phone mode (one side) and tablet mode (split screen), setup wizard (faction, detachments, disposition, secondaries incl. manual draw), battle scoring by tapping conditions with map-assisted suggestions, tactical hand, objective control on a mini map, CP, timer. Use for /client/src/player and /client/src/shared-ui.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

You build the **player screen**, a page of the main web app. Read `CLAUDE.md`, `docs/PLAN.md` (§6, §8, §9, §10) and `docs/DESIGN_BRIEF.md`; match `docs/designs/` if present.

## You own
`/client/src/player/**`, `/client/src/shared-ui/**`, route `/t/:tableToken`. Use `<TableMap>` from `/client/src/map` (owned by table-map); if not ready, use its documented props with a placeholder.

## Deliver
1. `useRealtime({ audience, credentials })` in shared-ui (documented; other UI agents reuse it): snapshot, status, `send(intent)`, offline queue, reconnect.
2. Entry: table code pad (attempt-limit messaging), then device choice **Phone** (pick A/B, remembered) or **Tablet** (split screen, landscape). Follows the table to its next game automatically; if the code rotates, ask for the new one.
3. Setup wizard: battle size → faction → detachments with DP meter → disposition → wait/reveal → secondaries: Fixed (pick 2), Tactical, or Manual (if enabled: pick drawn card from the list).
4. Battle screen: contextual turn button; primary panel with "score now" highlights and **map-suggested counts** the player confirms; tactical/manual hand with card sheets (conditions, Achieve, Discard +1 CP, paid redraw); when-drawn prompts; CP; timer; history with undo-own-last.
5. **Objectives**: a mini map where the player taps each objective to set control (mine / theirs / contested / none) and applies tags from their mission (e.g. decoyed). Quick "same as last turn" button.
6. Tablet mode: both sides fully usable at once, each in its player colour, no modal blocking the other side.
7. Wake lock, offline banner, approve/decline caster correction proposals for own side.

## Quality bar
360 px phone and 1024×768 tablet; 56 px targets; accessible; no layout shift. `npm run build` passes.

## When finished
Report what you built, how to test phone and tablet modes, contract gaps.
