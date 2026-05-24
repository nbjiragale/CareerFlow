# Development Guide

CareerFlow supports two dev tracks. Pick whichever fits what you're doing.

| Track | Command | Use when |
|---|---|---|
| **Active development** | `npm run dev` | You're writing code. Fast HMR, no container rebuild loop. |
| **Self-host / integration test** | `docker compose up` | You want to validate the production-style image, or you're a user just running the app locally. |

Both tracks use SQLite. Neither requires any external service to start. AI features require a provider key configured in Settings → AI after you sign in.

---

## Track 1 — Active development (no Docker)

### Prerequisites
- Node.js 20+ (the `Dockerfile` pins `20.18.0-alpine`; any 20.x locally is fine)
- npm 10+
- (Optional) Ollama if you want to test against a local LLM with no API key

### One-time setup

```bash
git clone https://github.com/nbjiragale/CareerFlow.git
cd CareerFlow
cp .env.example .env

# Generate secrets (only required for local dev — Docker auto-generates them)
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

npm install
npx prisma generate
npx prisma migrate dev
```

`npx prisma migrate dev` creates a fresh SQLite file at `prisma/dev.db` and applies every migration.

### Day-to-day

```bash
npm run dev          # starts Next.js on http://localhost:3737 with Turbopack
npm run lint         # eslint
npm test             # vitest (unit)
npm run test:e2e     # playwright (e2e)
```

### Resetting the local database

If the local SQLite drifts or you want a clean slate:

```bash
npm run db:reset
```

Runs `prisma migrate reset --force --skip-seed`, which drops the local SQLite, re-creates the schema, and re-applies every migration. Your application data is wiped — there's no undo. CareerFlow's encrypted API keys, Gmail tokens, and email threads all live in this file.

### Prisma after schema edits

```bash
npx prisma migrate dev --name <descriptive_name>   # creates + applies a migration
npx prisma studio                                  # GUI DB browser (optional)
```

Every CareerFlow PR that touches `prisma/schema.prisma` MUST include the generated migration file. Migrations are reviewed line-by-line as part of the PR (see the hard review gates in `docs/IMPLEMENTATION_PLAN.md`).

---

## Track 2 — Self-host / Docker

This is what most end-users will use, and what we test deployment with.

### Prerequisites
- Docker 24+
- Docker Compose v2

### Run it

```bash
git clone https://github.com/nbjiragale/CareerFlow.git
cd CareerFlow
docker compose up
```

Open <http://localhost:3737>. On first boot the container generates `AUTH_SECRET` and `ENCRYPTION_KEY` automatically and persists them; subsequent boots reuse them.

### Where data lives

SQLite + uploaded files live under `./jobsyncdb/data` on the host (see the `volumes:` mapping in `docker-compose.yml`). Back this directory up to back up your CareerFlow data.

### `.env` is NOT used by Docker

Docker Compose has its own environment block at the top of `docker-compose.yml`. Edits to `.env` only affect the `npm run dev` track. Configure Docker by editing `docker-compose.yml` (or by overriding env vars at the shell, e.g. `OPENAI_API_KEY=… docker compose up`).

### Phase 0 caveat: Docker still pulls the JobSync image

In Phase 0, `docker-compose.yml` references `ghcr.io/gsync/jobsync:latest` from upstream JobSync. Because the CareerFlow `main` branch is currently identical to JobSync's `main`, the running image matches the source — but as soon as CareerFlow lands its own code in Phase 1, this would silently drift. The plan switches `docker-compose.yml` to `build: .` (build from local source) when Phase 1 starts, and to `ghcr.io/nbjiragale/careerflow:latest` (CareerFlow's own published image) once the GHCR workflow ships in Phase 4. Until then, prefer the `npm run dev` track for testing any CareerFlow-specific changes.

---

## Common gotchas

- **`localhost:3737` is in use.** Either kill the conflicting process, or run the Next.js dev server on a different port: `next dev --turbopack -p 3738` (and update `NEXTAUTH_URL` to match).
- **Prisma client out of date after a schema change.** Run `npx prisma generate`. The dev server hot-reloads but the generated client isn't watched.
- **AI features show "no provider configured".** You need to sign in, go to Settings → AI, and add a provider key. Or set `OLLAMA_BASE_URL` and select Ollama (no key required).
- **Docker can't reach Ollama on the host.** The compose file maps `host.docker.internal` to the host gateway; Linux hosts may need `--add-host` or you can run Ollama inside a sibling container.

---

## Project layout (high-level)

```
src/
├── app/              # Next.js App Router
│   ├── (auth)/       # signup/login routes
│   ├── api/          # API route handlers (including CareerFlow additions)
│   └── dashboard/    # logged-in app
├── actions/          # Server actions (form posts, etc.)
├── auth.ts           # NextAuth config
├── components/       # React components (shadcn/ui-based)
├── lib/
│   ├── ai/           # Vercel AI SDK provider registry (multi-provider)
│   ├── db.ts         # Prisma client
│   ├── scheduler/    # node-cron entry; Gmail polling will hook in here
│   └── prompts/      # career-ops prompts (added in Phase 2)
└── models/           # Domain models + Zod schemas

prisma/
├── schema.prisma     # source of truth for the data model
└── migrations/       # one folder per migration; never edit applied migrations

docs/
├── PRD.md            # product requirements
├── IMPLEMENTATION_PLAN.md
└── DEVELOPMENT.md    # you are here
```

---

## When in doubt

Open an issue or ping in the PR. CareerFlow is intentionally a small project; we'd rather hash out a question on a PR than have someone guess.
