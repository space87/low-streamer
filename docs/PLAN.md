# Warhammer 40k Stream Scoreboard — Build Plan (v3)

Private, invite-only web app for **our channel**: players score 11th edition games, casters follow every event live and drive the overlays, OBS shows the result. Hosted online so players and remote casters can reach it; can also run offline at a venue.

> **Status:** the core rules engine (scoring, caps, decks, missions, validation, map suggestions, calibration maths) is already implemented and tested — see `docs/ENGINE.md`. Build on it; don't rewrite it.

## 1. People and pages

| Role | Signs in with | Main page | Can |
|---|---|---|---|
| **Owner** (us) | Discord (allow-listed) | `/control` | Everything: events, tables, invites, settings, data |
| **Producer** | Discord (invited) | `/control` | Run games, edit scores, switch live table, drive overlays |
| **Caster** | Discord (invited) | `/cast` | See everything live, drive the program overlay, map & telestrator, propose score corrections |
| **Player** | No account: table link + 4-digit code | `/t/:tableToken` | Set up and score their own side |
| **OBS** | Unguessable overlay token in URL | `/o/:overlayToken/...` | View only |

## 2. Stack (decided)

- TypeScript, Node 20+, Fastify + Socket.IO
- **Postgres** with Drizzle ORM + migrations (replaces SQLite: hosted, backups, concurrent access)
- React 18 + Vite + React Router, CSS modules; `zod` everywhere; `qrcode`; fonts bundled
- Auth: Discord OAuth2 (authorization code + PKCE) via a small maintained OAuth library; sessions in Postgres, httpOnly secure cookies
- Tests: Vitest + Playwright
- One container serves API, sockets and the built client

```
/server /client /shared /data /e2e /deploy /docs
```

## 3. Hosting and deployment

**Production (default):** one Docker container on a managed host in a **London region** (Fly.io recommended; Railway or Render also fine) + managed Postgres in a nearby EU/London region with automated daily backups. Single instance is plenty for our scale (no Redis needed). Custom domain, e.g. `scores.<ourchannel>.com`, TLS by the host.

**Staging:** identical second app + database, auto-deployed from the `main` branch; production deploys from git tags after a rehearsal.

**CI/CD:** GitHub Actions — typecheck, unit tests, `data:check`, Playwright smoke test, build image, deploy staging; manual approval → production. Database migrations run on deploy.

**Ops:** Sentry (errors, client + server), an uptime monitor on `/healthz`, structured logs. A **pre-stream checklist** page in control: DB reachable, data versions, overlay tokens valid, connected clients.

**Venue/offline mode:** `deploy/docker-compose.yml` runs app + Postgres on the stream PC. Players connect over venue Wi-Fi (or a phone hotspot); casters need internet, so for remote casters add a Cloudflare Tunnel. Export/import a game as JSON to move it between cloud and local mid-event if the internet dies.

**Secrets:** Discord client ID/secret, session secret, DB URL, Sentry DSN in the host's secret store; `.env.example` documents them.

**Privacy (UK GDPR basics):** we store Discord ID, username and avatar for staff only; players store nothing personal beyond the names they type. Short privacy note page; finished games auto-archive after 12 months (owner can export first).

## 4. Accounts and invites

- `OWNER_DISCORD_IDS` env var allow-lists owners.
- Owner creates an **invite link** (role: producer or caster, expiry, single-use). Invitee signs in with Discord → role granted. Owner can revoke anyone; revocation kicks live sessions.
- Everything under `/control` and `/cast` requires a session with the right role; every socket intent re-checks role server-side.
- No public sign-up.

## 5. Events, tables, games

- **Event** (title, date) → **Tables** → each table has a current **Game** and a history of games.
- Default: **New game** creates an event with one table; table UI stays hidden until **Add table**.
- **Live table** per event: what the program overlay and live-channel overlays show.

## 6. Player access (ideas adopted from gd streamer's player input)

- One **table link** per table (`/t/:tableToken`, QR on control and on a printable table card) that **follows every game played at that table** — no new links per round.
- A **4-digit table code** gates it; producers **rotate the code between games**, which locks out the previous players automatically. Links can be revoked/regenerated.
- **Phone mode**: pick Player A/B, full-screen own side, remembered on the device.
- **Tablet mode**: one shared landscape device, split screen, both sides; ideal for the feature table.
- Same link serves both; the device chooses on first open.

## 7. Rules data (`/data`, zod-validated at startup)

As v2 (dispositions, 5×5 matrix, 25 primaries, secondaries with Fixed/Tactical blocks and when-drawn rules, twists, caps incl. end-of-battle exemption, factions → detachments with DP and disposition, battle sizes) **plus board geometry**:

```ts
deployments: [{ id, name,
  board: { widthIn: 60, depthIn: 44 },
  zones: { attacker: Polygon, defender: Polygon },      // inches, origin bottom-left from attacker edge
  territoryLine: Line,
  objectives: [{ id, kind: "home-attacker"|"home-defender"|"expansion"|"central", x, y, terrainAreaIn?: Polygon }],
  centralVariant6?: [{ x, y }, { x, y }] }]             // the D6 = 6 two-central-objectives option
```
**Copyright guardrail unchanged:** names, numbers, coordinates and short paraphrases only — no GW card text, flavour or images. Layouts A/B/C terrain are not shipped; the map editor (§10) lets us place terrain areas ourselves.

## 8. Game flow

`lobby → army → reveal-disposition → mission → secondaries → battle(R1–R5) → finished` (unchanged from v2), with:
- **Mission step** also picks the deployment card (and D6 central-objective variant) → loads the board into the table map.
- **Secondary modes:** Fixed, Tactical (digital deck), or **Manual** (players draw physical cards and pick which they drew from a list; enabled per game).
- **Game timer:** countdown or target end time, per game; shown in overlays and on the player screen.

## 9. Scoring engine

Unchanged from v2: append-only ledger, server-side caps in order (per-score max → Fixed 20 per card → 15 per round except end-of-battle → 45 total), exclusive/cumulative logic, availability hints by round/timing/active player, adjustments, exact undo, tactical deck engine (draw 2, when-drawn rules, achieve, discard for +1 CP, once-per-battle paid redraw).

New:
- **Map-assisted primary suggestions:** when objective control is up to date (§10), the primary card panel pre-fills counts ("You control 3 objectives — 9 VP suggested") for conditions that depend on objective control. Players still confirm.
- **Caster corrections:** a caster can propose a ledger change; a producer or the affected player approves it.

## 10. Table map (v1)

**Model:** per game, the board from the deployment card + editable terrain areas + objectives with `controlledBy: A|B|null|contested`, operation markers per player, objective tags (decoyed, triangulated, consecrated, trapped…), "centre 3"/6"" rings.

**Who updates control:** players on their screen (tap objectives on a mini map at the end of a phase), casters, producers. Last write wins; every change logged in the feed.

**Rendering:** one `<TableMap>` component (SVG, inches as units) used by the player screen, caster console, control and overlays.

**Calibration ("AR-lite"):** in control, open the overhead camera view (OBS virtual camera or a still screenshot), click the four table corners → compute a homography → stored per table as a CSS `matrix3d`. The **map overlay** (`/o/:token/map`) renders the board transformed so objectives, zones and markers sit on the real table in the overhead shot. Recalibrate any time the camera moves. Optional later: ArUco corner markers + OpenCV.js for auto-calibration.

**Telestrator:** casters draw arrows, circles and freehand lines on the map; strokes appear on the map overlay live, fade after N seconds or on "clear". Pen colours per caster.

## 11. Overlays

**Program overlay** (`/o/:token/program`): one 1920×1080 browser source for the main scene, composed of layers casters/producers toggle live:
scoreboard bar · vertical sidebar (round-by-round, active and discarded secondaries) · matchup card · map inset · score-pop banners · lower thirds (caster names, custom text) · pinned secondary card · timer · "starting soon / break / coming next" scene cards.

**Standalone overlays** (for custom OBS scenes): `scoreboard`, `banner`, `sidebar`, `game-state` recap, `matchup`, `secondaries`, `map` (calibrated, for the overhead camera scene), `timer`, `scene`. Each exists per game and per live channel (`/o/:token/live/...`).

**Configure panel** (control): pick options (layout, lines shown, sizes, width, `bg=green|transparent`, style) with a live preview; it writes the URL to paste into OBS.

**Styles:** our grimdark-industrial style + a flat broadcast style, switchable per URL.

**Tactical hands on stream (default, changeable):** overlays show secondaries already scored plus a count of cards held; a caster toggle reveals the full hand (names only) when the players have agreed to it before the game.

**Score-pop banners:** fired automatically on ledger events (configurable: all scores / secondaries only / ≥5 VP) or manually by casters; queued so they never overlap.

Chroma-key rules unchanged: flat fills, solid outlines, no shadows/glow/blur/gradients/translucency against green; never blank on air; fonts local.

## 12. Caster console (`/cast`)

- **Live feed:** every ledger entry, card draw/discard, CP change, objective change, phase change, with player, card and VP; filter by table.
- **State panel:** both players' totals, per-round grid, primaries, Fixed pair or full tactical hand, CP, timer. Deck order never shown.
- **Spoiler view (optional per caster):** secret dispositions/secondaries before reveal, clearly marked "not on air".
- **Overlay control:** toggle program layers, fire banners/lower thirds, pin a card, highlight an objective, switch the map inset, telestrator canvas.
- **Live table switcher** (producer permission).
- **Correction proposals** (§9).
- Works on a laptop; usable on a tablet.

## 13. Control (`/control`, owner/producer)

Events and tables, Go live, table links/codes/QR and printable table cards, rotate code, game panels (phase, ledger edit, deck viewer, force-advance, undo), mission setup helpers, map editor + calibration, overlay Configure panel, invites and staff list, data versions, pre-stream checklist, export/import game JSON.

## 14. Realtime contract

Server-authoritative intents + per-audience snapshots:
- **player** (own seat, incl. own unrevealed choices) · **public** (overlays: nothing hidden leaks) · **caster** (everything except deck order; hidden picks only if spoiler view on) · **producer** (as caster + admin metadata).
- Separate low-latency channel for **overlay control** (layer toggles, banners, highlights) and **telestrator strokes** (throttled, ephemeral, not stored beyond the game).
- Socket auth: session cookie for staff, table token + code for players, overlay token for OBS.

Intent groups: `seat:*`, `army:*`, `mission:*`, `secondary:*`, `turn:*`, `score:*`, `cp:*`, `map:*` (control, markers, tags, terrain, calibration), `timer:*`, `program:*` (layers, banners, lower thirds, pin), `draw:*` (telestrator), `correction:*`, `admin:*`.

## 15. Data model (Postgres)

`users(discord_id, name, avatar, role)`, `invites`, `sessions`, `events`, `tables(table_token, code_hash, overlay_token, calibration_json)`, `games`, `players`, `ledger`, `deck_state`, `map_state`, `program_state`, `corrections`, `audit_log`. Indices on game_id everywhere; `version` column on games for monotonic snapshots.

## 16. Milestones

| # | Milestone | Owner agent(s) | Done when |
|---|---|---|---|
| M0 | Scaffold, `/shared` contract, Postgres + Drizzle, docker-compose dev | lead | `npm run dev` with local Postgres works |
| M1 | Rules + board data ∥ server core (auth, roles, state machine, scoring, decks, map state, program state) | `rules-data` ∥ `backend-realtime` | data:check + Vitest green; user verifies data checklist |
| M2 | Player screen ∥ overlays ∥ control + caster console ∥ table map | `player-screen` ∥ `overlays` ∥ `control-caster` ∥ `table-map` | a full game streams end-to-end locally |
| M3 | Deployment: staging live, CI/CD, Sentry, backups, offline compose | `devops-deploy` | staging URL works with Discord login from a phone and a remote laptop |
| M4 | QA across everything | `qa-tester` | all scenarios pass on staging |
| M5 | Production + rehearsal stream | lead + us | pre-stream checklist all green |
