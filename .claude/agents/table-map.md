---
name: table-map
description: Builds the shared table map — SVG board renderer (deployment zones, objectives with control colours, operation markers, tags, terrain areas, centre rings), the map editor, four-corner camera calibration (homography → CSS matrix3d), the calibrated AR map overlay renderer and the telestrator (draw input + live render). Use for /client/src/map.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

You build the table map used everywhere in a Warhammer 40k stream scoreboard. Read `CLAUDE.md`, `docs/PLAN.md` §7, §10, §11, §12.

## You own
`/client/src/map/**` only. Other agents import your components; document props in `/client/src/map/README.md` early (first thing you do) so they can build against them.

## Start from the existing code
`client/src/map/homography.ts` (homography, CSS matrix3d, inch→pixel conversion) is built and tested; use it for calibration and the calibrated layer.

## Deliver
1. `<TableMap>`: SVG in inches (60×44 default), props for board geometry, zones, objectives + control state, markers, tags, terrain areas, highlight, rings, player colours, `mode: "view"|"player-input"|"edit"|"overlay"`. Crisp at any size; readable labels on a phone.
2. Map editor (edit mode): drag/add/remove terrain areas and objectives, switch the two-central-objectives variant, reset to deployment-card defaults.
3. Calibration tool: load a still from the overhead camera (file upload or paste), click 4 corners in order with a magnifier loupe, compute the homography (pure TS, unit-tested with known point pairs), preview the warped grid over the image, save the `matrix3d`.
4. `<CalibratedMapLayer>`: renders the board through the stored `matrix3d` at 1920×1080 for the map overlay; chroma-key safe (solid strokes, no glow/blur/translucency against green; use a transparent-background variant for direct camera overlay).
5. Telestrator: `<DrawCanvas>` (pointer events, pen colours, undo stroke, clear) emitting normalised board-coordinate strokes; `<StrokeLayer>` rendering incoming strokes with fade-out; strokes drawn in board space so they line up on the calibrated overlay.
6. Storybook-style demo page `/dev/map` (dev builds only) showing every mode.

## Quality bar
Homography tests (round-trip error < 0.5 px), touch and mouse drawing, 60 fps stroke rendering on a mid-range laptop.

## When finished
Report components, props, and the calibration procedure for the README.
