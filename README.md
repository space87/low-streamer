# 40k Stream Scoreboard — Claude Code Kit (v3)

Everything Claude Code needs to build and deploy a private Warhammer 40,000 11th edition scoring app for our channel: player scoring by table link, Discord-login casters with a live console, a caster-driven program overlay, a calibrated table map with telestrator, and hosted deployment with an offline fallback.

## Contents
```
CLAUDE.md                   Project memory (loaded automatically)
docs/PLAN.md                The full build plan (v3)
docs/DESIGN_BRIEF.md        Visual brief for Claude Design and the UI agents
.claude/agents/             8 subagents: rules-data, backend-realtime, table-map,
                            player-screen, overlays, control-caster, devops-deploy, qa-tester
data/                       Filled in by rules-data
```

## Already built
The core rules engine is implemented and tested in this kit (`docs/ENGINE.md`). Check it runs: `npm run test:engine` (Node 22.18+). The agents build the rest on top of it.

## Before you start (things only you can do)
1. Create a GitHub repository.
2. Create a Discord application (devops-deploy writes `docs/DISCORD_SETUP.md` with exact steps; you can also do it after M3).
3. Have accounts ready for the host (Fly.io suggested) and a managed Postgres provider, plus Sentry (free tier is fine).
4. Decide the domain, e.g. `scores.<yourchannel>.com`.
5. Note your Discord user ID (Discord settings → Advanced → Developer Mode → right-click yourself → Copy User ID) for `OWNER_DISCORD_IDS`.

## Step 1: Design (Claude Design)
Paste `docs/DESIGN_BRIEF.md` into Claude Design and work through its ten screens. Save the approved designs to `docs/designs/`.

## Step 2: Project setup
```bash
mkdir wh40k-scoreboard && cd wh40k-scoreboard && git init
# copy this kit in, including .claude/
claude
```
Run `/agents` and check all eight are listed.

## Step 3: Kickoff prompt
> Read CLAUDE.md and docs/PLAN.md. You are the lead and integrator.
> Never stop at a milestone unless I've asked you to wait or you need something from me; after each milestone run every test suite, fix failures, and continue. Keep looping on QA until it reports no on-air blockers or annoying bugs.
> **M0**: run `npm run test:engine` to confirm the existing engine (docs/ENGINE.md) passes, then scaffold npm workspaces (server, client, shared, e2e, scripts), Postgres + Drizzle, deploy/docker-compose.yml for a dev database, and write the /shared contract (types, zod schemas, intents, snapshot types) from PLAN §7–§15. Commit.
> **M1**: run rules-data and backend-realtime in parallel. When rules-data finishes, show me docs/DATA_NOTES.md and wait for my confirmation. Ensure backend tests pass against the real data. Commit.
> **M2**: run table-map first until it has published /client/src/map/README.md, then run player-screen, overlays and control-caster in parallel while table-map finishes. Integrate, run a full local game with a caster session and the program overlay, fix gaps. Commit.
> **M3**: run devops-deploy. Stop and ask me for any credentials or account steps it needs. Get staging live.
> **M4**: run qa-tester against local and staging; route on-air blockers and annoying bugs to the owning agents and rerun until clean.
> **M5**: tag a release, deploy production, and give me the stream-night runbook summary.

Commit between milestones so you can roll back.

## Step 4: Verify and rehearse
- Check the rules data checklist against your physical Mission Deck and the current Munitorum Field Manual. Re-run rules-data after balance updates.
- Calibrate the map for your overhead camera (Control → Map → Calibrate).
- Rehearsal: two phones (or one tablet) + one remote caster on Discord + OBS with the program overlay and the map overlay. Run the pre-stream checklist.
- Practise the venue fallback once: export a game, start `deploy/docker-compose.yml` on the stream PC, import, continue.

## Note on rules data
Mission and faction data are for private use on our stream and contain only names, numbers, coordinates and short paraphrases. Don't publish them.
