---
name: control-caster
description: Builds the staff pages — Discord sign-in screens, the control screen for owner/producer (events, tables, Go live, table links/codes/QR, printable table cards, game panels, ledger editing, deck viewer, map editor + calibration, overlay Configure panel, invites, pre-stream checklist, export/import) and the caster console (live feed, state panel, spoiler view, program-overlay controls, telestrator, corrections). Use for /client/src/control, /client/src/cast, /client/src/auth.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

You build the staff side of a private Warhammer 40k stream scoreboard. Read `CLAUDE.md`, `docs/PLAN.md` §1, §4–§6, §10–§14 and `docs/DESIGN_BRIEF.md`.

## You own
`/client/src/control/**`, `/client/src/cast/**`, `/client/src/auth/**`; routes `/login`, `/invite/:code`, `/control/*`, `/cast/*`. Reuse `useRealtime` (shared-ui) and map components (`/client/src/map`). UI must hide what a role can't do, but never rely on that for security.

## Control (owner/producer)
- Events and tables; Add table; Go live; single-table games show no table UI.
- Table links: QR, current code (click to reveal), **Rotate code**, revoke/regenerate, printable A5 table card (QR + instructions).
- Game panel: players and seat connection, phase/round/active player with force-advance, ledger (edit/delete/adjust), deck viewer (hand/discard/achieved only), CP, timer controls, undo, finish, export/import JSON.
- Mission helpers: attacker/defender, first turn, twist, deployment + variant.
- Map editor + calibration (from table-map components), saved per table.
- Overlay **Configure** panel: choose overlay + options with live preview → copy URL. Regenerate overlay token.
- Staff: invite links (role, expiry), staff list, revoke (owner only).
- Data panel and **pre-stream checklist** (calls `/api/prestream-check`).
- Banner: this page is staff-only; keep it off stream.

## Caster console (`/cast`)
- Live feed with filters; state panel; spoiler toggle (per caster, clearly marked "not on air").
- Program controls: toggle each layer, fire score banner or custom lower third, pin a secondary, highlight an objective, switch map inset, scene cards.
- Telestrator: `<DrawCanvas>` over the map with pen colour per caster; clear.
- Live table switcher if role allows; propose correction (form → pending until approved).
- Keyboard shortcuts for common actions (documented in a `?` overlay); usable on a 1366×768 laptop and an iPad.

## Quality bar
`npm run build` passes; role-based visibility tested with mock sessions.

## When finished
Report pages, shortcuts, and any contract gaps.
