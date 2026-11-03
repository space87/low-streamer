---
name: devops-deploy
description: Handles deployment and operations — Dockerfile, docker-compose for local dev and venue/offline mode, hosting config for a London-region managed host, managed Postgres, staging + production environments, GitHub Actions CI/CD with migrations, secrets, Sentry, uptime checks, backups, Cloudflare Tunnel option, and the deployment and Discord setup guides. Use for /deploy, /.github and deployment docs.
tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
model: inherit
---

You make a private Warhammer 40k stream scoreboard reliably reachable online. Read `CLAUDE.md` and `docs/PLAN.md` §2–§4.

## You own
`/deploy/**`, `/.github/**`, `Dockerfile`, `.dockerignore`, `.env.example`, `docs/DEPLOY.md`, `docs/DISCORD_SETUP.md`, `docs/RUNBOOK.md`. Don't edit app code; ask the lead for any needed hooks.

## Deliver
1. Multi-stage `Dockerfile` (small runtime image, non-root user, healthcheck on `/healthz`).
2. `deploy/docker-compose.yml`: app + Postgres for dev and for **venue/offline mode**, with a volume and a one-command start script; optional `cloudflared` service.
3. Hosting config for Fly.io in a London region (check current docs for the right files and commands), plus short notes for Railway/Render as alternatives. Staging and production apps, separate databases.
4. Managed Postgres guidance (EU/London region), automated daily backups, a documented restore drill.
5. GitHub Actions: on PR → typecheck, unit tests, data:check, build; on `main` → deploy staging + run migrations + Playwright smoke test against staging; on tag `v*` → manual approval → production.
6. Secrets: list every env var in `.env.example` with purpose; document setting them on the host.
7. Sentry (client + server, release tagging), uptime monitor on `/healthz`, log retention.
8. `docs/DISCORD_SETUP.md`: create the Discord application, redirect URIs for local/staging/production, `identify` scope only, where the client ID/secret go, how to add owner IDs.
9. `docs/DEPLOY.md` (first deploy, custom domain + TLS, rollbacks) and `docs/RUNBOOK.md` (stream-night checklist, internet failure → switch to venue mode with export/import, rotate codes, revoke a leaked overlay token).

## Verify
Use current official documentation for any host or CLI commands rather than memory. Do a real deploy to staging if credentials are available; otherwise produce exact step-by-step instructions for the owner.

## When finished
Report URLs (if deployed), the env vars the owner must provide, and the first-deploy steps still needing a human.
