# Design Brief — 40k Stream Scoreboard (11th edition)

Use in **Claude Design** to mock up screens before building; save approved designs to `docs/designs/`.

## Audiences
- **Overlay viewers** on Twitch/YouTube, often on phones: totals readable in under a second at 720p; mission context (dispositions, primaries, secondaries in hand) available but quieter.
- **Players** at the table, phone in one hand, dice in the other, dim lighting. Scoring must be "tap what happened, confirm".
- **Streamer** at a desktop mid-broadcast: speed, overview of all tables, undo.

## Visual direction
Grimdark-industrial: engraved metal plates, data-slate readouts, sparing hazard stripes. Not fantasy parchment, not esports neon.

Starting tokens (refine in Claude Design):
- Plate `#1A1D21` · Steel `#8A929B` · Bone `#E8E2D0` · Brass `#B8893A` · Alert `#B3261E`
- Each player's chosen colour as a thick side stripe and on their total.
- Five Force Disposition marks: design a simple, original geometric glyph for each (don't copy GW icons), each with its own accent.
- Key colour `#00FF00` never appears in the UI.

Type: one heavy condensed display face for numbers and names (bundled locally, tabular figures) + one plain sans for small text.

## Screens to mock up
1. **Overlay bottom bar** (1920×1080 on `#00FF00`): mid-game round 3, Player A Take and Hold on Battlefield Dominance holding 3 tactical cards, Player B Purge the Foe on Unstoppable Force with Fixed secondaries. Totals are the hero.
2. **Overlay matchup reveal**: two dispositions face off, each player's primary named beneath.
3. **Player screen — setup**: faction search → detachment picker with DP budget meter → disposition choice.
4. **Player screen — battle** (390×844): turn button, primary card with "score now" blocks highlighted, tactical hand list, card sheet with condition buttons and a count stepper.
5. **Control** (1440×900): table strip (3 tables, one live), game panel with join code/QR, ledger, deck viewer.

## Rules
- Overlay: flat fills, solid 2–3 px outlines, no shadows/glows/blur/gradients/transparency near the key; 48 px safe margin; hands of up to 8 cards must fit as chips.
- Player screen: dark by default, 56 px targets, numbers ≥48 px on the main score, plain specific copy ("Start my turn", "Score 4 VP", "Capped: 15 VP this round").
- Control: dense, keyboard friendly, big Undo and Go live.

## Added in v3
6. **Caster console** (1366×768 laptop): live feed column, state panel, program-layer toggles as a grid of large switches, banner/lower-third composer, map with telestrator pens. Must be operable while talking: big targets, keyboard shortcuts, nothing hidden in menus.
7. **Program overlay** composition (1920×1080 on green): show where every layer sits so they never collide — scoreboard bar, sidebar, map inset, banner zone, lower-third zone, pinned card zone.
8. **Calibrated map overlay**: a top-down table photo with the board warped onto it — objectives as clean rings filled with the controller's colour, zones as thin outlines, a telestrator arrow. Must read clearly over a busy, colourful table: thick strokes, high-contrast outlines, no fills that hide models.
9. **Printable table card** (A5): QR, short URL, "Ask the streamer for the 4-digit code".
10. **Flat broadcast style** variant of the scoreboard and sidebar alongside the grimdark style.
