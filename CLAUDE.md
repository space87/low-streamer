# CLAUDE.md — 40k Stream Scoreboard (11th edition, v3)

Private, invite-only web app for our channel. Players score Warhammer 40,000 11th edition games from a table link (phone or shared tablet); casters sign in with Discord, follow every event live and drive a layered program overlay, a calibrated table map and a telestrator; OBS shows the overlays. Hosted online (London region) with a venue/offline fallback.

**Read `docs/PLAN.md` first** — source of truth for stack, roles, hosting, rules data, flow, scoring, map, overlays and milestones. `docs/DESIGN_BRIEF.md` governs visuals.

## Ground rules
- TypeScript strict. `/shared` is the contract; changes update server and client together and go in `docs/CHANGELOG.md`.
- Rules and board geometry live in `/data`; `npm run data:check` must pass.
- Server is authoritative for VP, caps, primaries, decks and permissions. Every intent is role-checked server-side.
- Hidden information never leaks: deck order to nobody; unrevealed picks only to their owner and spoiler-enabled casters.
- Copyright: data holds names, numbers, coordinates and short paraphrases only — no GW card text, flavour or art; no GW faction icons.
- Overlays never go blank on air; chroma-key safe; fonts local; no third-party runtime calls from overlays.
- Secrets only via env vars; never commit them.
- Ask before adding heavy dependencies.

## Commands
- `docker compose -f deploy/docker-compose.yml up -d db` then `npm run dev`
- `npm test`, `npm run e2e`, `npm run data:check`, `npm run db:migrate`
- `npm run build && npm start`

## Subagents (`.claude/agents/`)
| Agent | Owns | Milestone |
|---|---|---|
| `rules-data` | `/data`, `/scripts/data-check.ts` | M1 |
| `backend-realtime` | `/server`, `/shared`, migrations | M1 |
| `table-map` | `/client/src/map` | M2 (publish its README first) |
| `player-screen` | `/client/src/player`, `/client/src/shared-ui` | M2 |
| `overlays` | `/client/src/overlay` | M2 |
| `control-caster` | `/client/src/control`, `/client/src/cast`, `/client/src/auth` | M2 |
| `devops-deploy` | `/deploy`, `/.github`, Dockerfile, deploy docs | M3 |
| `qa-tester` | `/e2e`, `docs/QA_REPORT.md` | M4 |

Agents edit only their own folders; contract changes go back to the lead session.
