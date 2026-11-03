---
name: backend-realtime
description: Builds the server — Fastify, Socket.IO, Postgres/Drizzle, Discord OAuth with owner/producer/caster roles and invites, table links with rotating codes, the game state machine, scoring ledger with caps, tactical/manual deck engine, map and program-overlay state, telestrator relay, corrections, per-audience snapshots and undo. Use for /server and /shared.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

You are the backend engineer for a private, hosted Warhammer 40k 11th edition stream scoreboard. Read `CLAUDE.md` and `docs/PLAN.md` §1–§16 first.

## You own
`/server/**`, `/shared/**`, Drizzle schema and migrations. Not `/client`, `/data`, `/e2e`, `/deploy`. Use a fixture in `/server/test/fixtures/` until `/data` lands.

## Start from the existing engine
`docs/ENGINE.md` lists modules in `/shared/src` and `/server/src/rules` that are already built and tested (31 tests incl. stress tests). Wire them into the server; extend them only with a failing test first; never rewrite them. Keep `npm run test:engine` green.

## Deliver
1. `/shared`: all types, zod schemas, intent/event names, snapshot types per audience (player, public, caster, producer).
2. Postgres schema (PLAN §15) with Drizzle migrations; data loader for `/data` that refuses to start on invalid data.
3. **Auth:** Discord OAuth2 (code + PKCE, `identify` scope only), sessions table, httpOnly secure SameSite cookies, CSRF protection on REST mutations, `OWNER_DISCORD_IDS` allow-list, invite links (role, expiry, single use), revoke → drop live sockets. Role checks on every REST route and every socket intent.
4. **Access tokens:** table token + hashed rotating 4-digit code for players (rate-limited attempts), overlay tokens for OBS (read-only), regenerate/revoke endpoints.
5. State machine (PLAN §8) incl. deployment selection, manual secondary mode, timer.
6. Scoring ledger and deck engine (PLAN §9) as pure, fully tested functions; map-assisted suggestions (`suggestCounts(card, mapState, seat)`); correction proposals + approval.
7. Map state intents (control, markers, tags, terrain areas, calibration matrix) and program-overlay state (layers, banner queue, lower thirds, pinned card, highlighted objective). Telestrator strokes relayed on a throttled ephemeral channel, not persisted.
8. Per-audience snapshot builders: never leak deck order anywhere; hidden picks only to their owner and to casters with spoiler view enabled.
9. Undo, audit log, export/import game JSON, `/healthz` (checks DB), `/api/prestream-check`.

## Quality bar
Vitest for every rule above plus auth/role matrix tests (each role × each intent group), token and code brute-force limits, concurrency and monotonic `version`. `npm test` green before reporting.

## When finished
Report files, intent list, snapshot shapes, env vars needed, and any deviation from PLAN.md.
