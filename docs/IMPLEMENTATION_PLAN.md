# CareerFlow AI — Implementation Plan (v2: JobSync-fork edition)

**Source PRD:** CareerFlow AI v2.0 (Integration-First Edition), May 24 2026
**Target repo:** [`nbjiragale/CareerFlow`](https://github.com/nbjiragale/CareerFlow) (currently empty)
**Supersedes:** v1 plan (Tauri / monorepo-from-scratch direction). v1 is rejected.
**Plan status:** Draft for review — no code written yet.

---

## 0. TL;DR

Fork [`Gsync/jobsync`](https://github.com/Gsync/jobsync) into `nbjiragale/CareerFlow`. Port [`Tomiwajin/CareerSync`](https://github.com/Tomiwajin/CareerSync)'s Gmail OAuth + email-processing code into it as new API routes. Add three thin career-ops-derived endpoints (evaluate JD, draft reply, timeline). Ship in **~4–5 weeks** as a single `docker compose up` localhost product.

No Rust, no Tauri, no Supabase, no Vercel, no Trigger.dev, no Novu, no Python sidecar (for MVP), no custom monorepo scaffolding.

---

## 1. What JobSync already gives us (verified by reading the repo)

This is why the JobSync-fork direction is so much cheaper than v1 — most of the original PRD §11 stack is already built and shipping:

| PRD requirement | JobSync status | Source |
|---|---|---|
| Docker single-container self-host | **Done** — `docker compose up` → `localhost:3737` | `docker-compose.yml`, `Dockerfile` |
| Next.js 15 + shadcn/ui + Tailwind | **Done** | `package.json` |
| Local DB | **Done** — SQLite via Prisma 6, volume-mounted | `prisma/schema.prisma` |
| BYO AI key, encrypted at rest | **Done** — `ApiKey` model with `encryptedKey`, `iv`, `last4`, per-provider | `prisma/schema.prisma` lines 39–54 |
| Multi-provider AI | **Done** — OpenAI, Gemini, DeepSeek, OpenRouter, Ollama via Vercel AI SDK | `src/lib/ai/provider-registry.server.ts` |
| AI Resume review | **Done** — `/api/ai/resume/review` | repo |
| AI Resume ↔ JD match scoring | **Done** — `/api/ai/resume/match` (covers Resume-Matcher's MVP value with no Python) | repo |
| Structured resume builder (replaces OpenResume need) | **Done** — Resume + Sections + WorkExperience + Education + Summary + … | schema lines 73–167 |
| In-process scheduler (replaces Trigger.dev) | **Done** — `node-cron` wired via `src/lib/scheduler/index.ts` and `instrumentation.ts` | repo |
| User-defined automations (recurring jobs) | **Done** — `Automation` model + actions + scheduler integration | schema + `src/actions/automation.actions.ts` |
| Auth | **Done** — NextAuth credentials provider | `src/auth.ts`, `src/auth.config.ts` |
| Job tracking | **Done** — `Job`, `JobTitle`, `Location`, `Company`, `JobSource` | schema |
| Recruiter contacts | **Done** — `Contact` model | schema |
| Activity / task tracking (timeline foundation) | **Done** — `Activity`, `ActivityType`, `Task` | schema |
| Notes, tags, custom questions | **Done** | schema |
| Rich text editing | **Done** — Tiptap | deps |
| Analytics charts | **Done** — Nivo (bar, calendar, etc.) | deps |
| Tests | **Done** — Vitest + Playwright + Testing Library | repo |
| License | **MIT** — compatible | `LICENSE` |

**License check across all upstream OSS:**
- JobSync — MIT
- CareerSync (`Tomiwajin/CareerSync`) — MIT
- Resume-Matcher (per PRD) — Apache 2.0
- OpenResume (per PRD) — permissive
- CareerFlow itself — recommend **MIT** to match the base.

All compatible.

---

## 2. Important correction about CareerSync

**Errata note (2026-05-24):** the original v2 of this plan claimed CareerSync was "pure Next.js + `googleapis` + regex pattern matching, no HuggingFace dependency." That was wrong — I had only read `lib/email-utils.ts` (which is regex, but is used for *exclusion filtering* of emails like `*@indeed.com`, not for classification). The actual classifier is at [`app/api/process-emails/route.ts:53-82`](https://github.com/Tomiwajin/CareerSync/blob/main/app/api/process-emails/route.ts) and calls a **HuggingFace Space via the `@gradio/client` library** — env var `HUGGINGFACE_SPACE_URL` (format `your_hf_username/your_space_name` per CareerSync's `.env.example:9-10`). So CareerSync IS dependent on a remote ML service; we just don't run a Python sidecar locally.

**Effect on the plan:** CareerFlow's classifier strategy is **Option A — use a HuggingFace Space via Gradio** (locked decision, 2026-05-24). We either point at CareerSync's existing public Space or deploy our own from CareerSync's HF repo. The classifier interface is a single `classifyEmail(text): Promise<{ label, confidence, company?, role? }>` call; the Space handles classification + extraction in one combined endpoint (`/process_batch`).

**Other classifier options we did NOT pick** (kept here for traceability):
- **Option B** — Use the user's configured LLM via Vercel AI SDK `generateObject`. Fits BYO-key story, free with Ollama, ~$0.001/email with paid providers. Slower (1-3s per email).
- **Option C** — Bundle a SetFit-style Python classifier as a sidecar. Same complexity tax we deferred Resume-Matcher to avoid.
- **Option D** — Tiny local model via Ollama only (Llama 3.2 1B / Phi-3 Mini). Free, offline, but lower accuracy.

CareerSync's relevant files we'll port:
- `app/api/auth/gmail/route.ts` — OAuth init
- `app/api/auth/callback/route.ts` — OAuth callback
- `app/api/auth/status/route.ts` — connection status
- `app/api/auth/logout/route.ts` — disconnect
- `app/api/process-emails/route.ts` — fetch, parse, classify, return structured rows (calls the HuggingFace Space)

We'll discard CareerSync's Supabase + Zustand state code and rewire data persistence through Prisma into JobSync's existing `Job` / new `EmailThread` tables. The cookie-based token storage will be replaced with our encrypted `OAuthToken` model (PRD hard-review gate).

---

## 3. What we're dropping from the original plan

| Originally planned | Dropped because | Revisit when |
|---|---|---|
| Supabase | JobSync uses SQLite + Prisma, simpler and local-first | — |
| Tauri / native installers | User pushback (correct); Docker Compose is the standard self-host pattern | — |
| Trigger.dev managed scheduler | `node-cron` already in JobSync | — |
| Novu | Native browser notifications via JobSync's existing UI; email reminders are optional | Phase 5+ |
| OpenResume embed | JobSync already has a full structured resume builder | If JobSync's PDF export proves inadequate |
| Resume-Matcher Python sidecar | `/api/ai/resume/match` already does this with the user's LLM | Phase 3+ if offline / semantic scoring is needed |
| Monorepo with pnpm/Turborepo | Single Next.js repo (JobSync's structure) is enough | — |
| Custom AI provider abstraction | Vercel AI SDK already abstracts providers in JobSync | — |
| Server-side envelope encryption design | JobSync already encrypts AI keys with AES per-row IV | — |

---

## 4. What we're adding on top of JobSync

Four discrete, additive workstreams. None require touching JobSync's core.

### 4.1 Gmail integration (new feature in CareerFlow)
- Port CareerSync's 5 Gmail-related route files into `src/app/api/gmail/*`.
- Add Prisma model `EmailThread`:
  ```prisma
  model EmailThread {
    id              String   @id @default(uuid())
    userId          String
    user            User     @relation(fields: [userId], references: [id])
    gmailThreadId   String
    jobId           String?  // FK to existing Job
    job             Job?     @relation(fields: [jobId], references: [id])
    classification  String   // Applied | Interview | Rejected | Offer | NextPhase | NotJobRelated
    confidence      Float
    subject         String
    snippet         String
    fromAddress     String
    receivedAt      DateTime
    body            String?  // opt-in, encrypted if stored
    createdAt       DateTime @default(now())
    @@unique([userId, gmailThreadId])
    @@index([userId, receivedAt])
  }
  ```
- Add Prisma model `OAuthToken` for Gmail tokens (encrypted with the same scheme as `ApiKey`):
  ```prisma
  model OAuthToken {
    id            String   @id @default(uuid())
    userId        String   @unique
    provider      String   // "google"
    accessToken   String   // encrypted
    refreshToken  String   // encrypted
    iv            String
    scope         String
    expiresAt     DateTime
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }
  ```
- Add `EmailClassificationCorrection` to feed user corrections back (PRD §14 mitigation):
  ```prisma
  model EmailClassificationCorrection {
    id               String   @id @default(uuid())
    userId           String
    emailThreadId    String   @unique
    original         String
    corrected        String
    confidenceAtTime Float
    createdAt        DateTime @default(now())
  }
  ```
- Wire CareerSync's email-processing function into JobSync's existing `src/lib/scheduler/index.ts` as a 15-minute recurring task.
- On classification: upsert into `EmailThread`, auto-create or link to a `Job` row when confidence > threshold, emit an `Activity` row (this becomes the timeline event source — see §4.4).

### 4.2 JD Evaluation endpoint (career-ops port)
- New route `src/app/api/evaluate/route.ts`:
  - Input: `{ jdText, archetype, weights? }`
  - Calls user's configured AI provider via the existing `provider-registry.server.ts`.
  - Returns: A–F grade + 10 dimension scores + rationale (structured output via Vercel AI SDK's `generateObject`).
- Prompt template extracted from career-ops, stored in `src/lib/prompts/career-ops/evaluate.v1.ts` with a `SOURCE_SHA` constant pointing to the upstream commit (PRD §14 mitigation).
- New UI: `src/app/dashboard/evaluate/page.tsx` — paste JD → archetype picker → scoring card.
- New Prisma additions to existing `Job` model:
  ```prisma
  // additions to existing Job model
  evaluationGrade  String?
  evaluationJson   Json?     // dimension scores + rationale
  evaluatedAt      DateTime?
  ```

### 4.3 AI reply draft endpoint
- New route `src/app/api/drafts/reply/route.ts`:
  - Input: `{ emailThreadId, intent: "reply" | "follow-up" | "thank-you" | "confirm" }`
  - Pulls the thread, user's resume summary, and current `Job` context.
  - Returns generated draft text only — **no autonomous send** (PRD §9.5 hard constraint).
- UI: drawer on the email thread view with "Copy" and `mailto:` buttons.
- New Prisma model `AiDraft`:
  ```prisma
  model AiDraft {
    id            String   @id @default(uuid())
    userId        String
    emailThreadId String?
    jobId         String?
    draftType     String   // reply | follow-up | thank-you | confirm
    content       String
    createdAt     DateTime @default(now())
  }
  ```

### 4.4 Unified timeline view
- JobSync's existing `Activity` table already supports polymorphic activity logging.
- Add a `source` column (`manual | gmail | ai_eval | ai_match | ai_draft | scheduler`) and a `metadataJson` column to `Activity`.
- New UI: per-job timeline component aggregating `Activity` + `EmailThread` + `AiDraft` rows ordered by time.

---

## 5. Auth — addressing "No Auth if possible"

JobSync ships with NextAuth credentials (email/password). Three options, in order of effort:

| Option | Effort | UX | Recommendation |
|---|---|---|---|
| **A. Keep JobSync's NextAuth as-is** | Zero | One-time signup on first boot, then forgotten | **Recommended for v1** — minimum touch, doesn't break the userId FK chain that runs through 20+ tables |
| **B. Auto-bootstrap a "default user" on first boot + auto-login cookie** | ~half a day | True zero-friction "no auth feel" | Add in Phase 1 polish if (A) annoys you |
| **C. Strip NextAuth entirely** | High | None | **Not recommended** — every model has `userId`, ripping it out is invasive and risky |

The pragmatic answer: **A for MVP, B as a polish item.** Option B is implemented as: on container start, if no user exists, seed a `default@local` user, then a middleware that auto-creates a session cookie when one's missing on localhost. Functionally identical to "no auth" while preserving the schema.

LAN-exposure caveat: if a user exposes the container on their LAN, A's password is the only safety net. We should call this out in the README and recommend a passphrase in `.env`.

---

## 6. Database schema delta

Only **4 new models** and **~4 column additions** vs JobSync's existing schema:

```
NEW:
  EmailThread
  OAuthToken
  EmailClassificationCorrection
  AiDraft

ADD to existing Job:
  evaluationGrade, evaluationJson, evaluatedAt, gmailLinked (boolean)

ADD to existing Activity:
  source, metadataJson
```

Everything else PRD §10 wanted (users, applications, resumes, contacts, tasks/reminders) maps cleanly to JobSync's existing models. No schema rewrites needed.

Migrations land as a single `prisma migrate dev --name careerflow_extensions` per feature PR.

---

## 7. AI strategy

Use JobSync's existing setup unchanged. The pattern for every new AI feature:

```ts
// src/app/api/evaluate/route.ts
import { getProviderForUser } from "@/lib/ai/provider-registry.server";
import { generateObject } from "ai";
import { evaluateSkill } from "@/lib/prompts/career-ops/evaluate.v1";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  const body = evaluateSkill.input.parse(await req.json());
  const model = await getProviderForUser(session.user.id);
  const { object } = await generateObject({
    model,
    schema: evaluateSkill.output,
    system: evaluateSkill.system,
    prompt: evaluateSkill.render(body),
  });
  await persistEvaluation(session.user.id, body, object);
  return Response.json(object);
}
```

Every career-ops mode becomes one file under `src/lib/prompts/career-ops/` + one route file. Mechanical, not architectural.

**AI audit log:** add a small `AiAuditLog` model (tokens in/out, cost estimate, status, error) written via a single wrapper around the AI SDK calls. Powers a Settings → Usage page.

---

## 8. Phased plan (revised — much tighter than v1)

### Phase 0 — Fork & baseline (Days 1–3)
- Fork `Gsync/jobsync` into `nbjiragale/CareerFlow`.
- Push to `main`. Update README header to say "CareerFlow AI (based on JobSync)" with attribution.
- Add `upstream` remote pointing to JobSync; document the monthly merge-from-upstream chore in `CONTRIBUTING.md`.
- **Establish two-track dev workflow:**
  - **Active dev (no Docker):** `npm install && npm run dev` → `next dev --turbopack -p 3737`, with `DATABASE_URL=file:./prisma/dev.db`. `.env.example` checked in. `npm run db:reset` script for a fresh local SQLite. Document in `docs/DEVELOPMENT.md`.
  - **Self-host / deploy (Docker):** `docker compose up` unchanged from JobSync, against `file:/data/dev.db` in mounted volume.
- Verify both tracks work end-to-end (signup, add job, AI resume review, AI job match).
- Commit the PRD and this plan into `docs/`.
- Open a Google Cloud Console project for Gmail OAuth; file Testing-mode verification with `gmail.readonly` scope (production verification can wait — PRD §14 noted this).
- Open a GitHub Project board or milestone for Phase 1 tracking.
- **Exit criteria:** fresh clone → both `npm run dev` and `docker compose up` work; every existing JobSync feature works without modification on both tracks.

### Phase 1 — Gmail integration (Days 4–10)
- Port CareerSync's 5 Gmail API route files.
- Add `EmailThread`, `OAuthToken`, `EmailClassificationCorrection` models + migration.
- Add `Gmail` tab in the dashboard sidebar.
- Settings → Integrations → "Connect Gmail" button → OAuth flow → tokens encrypted into `OAuthToken`.
- Manual "Sync now" + scheduled job (`node-cron` every 15 min).
- Classification → auto-link or auto-create a `Job` row when confidence > 0.75 (threshold user-configurable).
- "Needs review" tab for low-confidence threads → user correction writes `EmailClassificationCorrection`.
- **Exit criteria:** connect Gmail with a seeded test inbox → see at least 5 jobs auto-populated within 15 minutes, with low-confidence ones in the review tab.

### Phase 2 — JD evaluation + AI reply drafts (Days 11–17)
- Extract career-ops `evaluate` prompt → `src/lib/prompts/career-ops/evaluate.v1.ts` with pinned `SOURCE_SHA`.
- `POST /api/evaluate` + dashboard `/dashboard/evaluate` page.
- Score persisted on `Job`; surfaced in the job detail view.
- `POST /api/drafts/reply` + drawer UI on the email thread view.
- Three intents: reply, follow-up, thank-you. All draft-only, never send.
- `AiAuditLog` model + Settings → Usage page.
- **Exit criteria:** paste JD → score in <10s → open a recruiter email → "Draft reply" → copy to clipboard or `mailto:`.

### Phase 3 — Unified timeline + reminders + polish (Days 18–25)
- Add `source` + `metadataJson` to `Activity`; backfill existing rows.
- Per-job timeline component combining `Activity` + `EmailThread` + `AiDraft`.
- Reminder system: use JobSync's existing `Task` model + `node-cron` to fire native browser notifications (Notification API in the dashboard) and optional email via Nodemailer when `SMTP_*` env vars are set.
- Settings → Data Export (JSON dump of all user rows). Settings → Delete Account.
- Polish: dashboard analytics tiles (response rate, funnel, AI spend).
- **Exit criteria:** seeded demo data shows a complete recruiter conversation as a timeline with classification, score, drafted reply, reminder all visible.

### Phase 4 — Release prep (Days 26–30)
- Update README with screenshots, GIFs, full feature list, attribution to JobSync + CareerSync + career-ops.
- Self-host docs: `docs/SELF_HOSTING.md`.
- One GitHub Action that builds + pushes a `ghcr.io/nbjiragale/careerflow:latest` image and a `:vX.Y.Z` tag.
- Write `docs/MIGRATING_FROM_JOBSYNC.md` for existing JobSync users.
- v1.0.0 tag + GitHub Release.

**Total: ~30 working days (~6 calendar weeks at a relaxed solo pace).**

### Phase 5+ — Beyond MVP (not committed)
- Resume-Matcher Python sidecar (offline / semantic scoring with Ollama)
- OpenResume PDF export polish (if needed)
- Portal scanner (Playwright)
- LinkedIn outreach generator
- Chrome extension
- Outlook support
- Default-user auto-login (Auth Option B above)

---

## 9. Risk register (revised)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Gmail OAuth Testing-mode 100-user limit | Med | Caps adoption | Document self-hosting path with user-supplied OAuth credentials — every self-hoster makes their own Cloud Project. Removes the 100-user cap. |
| R2 | JobSync upstream drift breaks merges | Med | Maintenance pain | Keep added code in clearly-named files (`*.careerflow.ts`); never modify JobSync's existing files without a comment marker. Monthly upstream merge chore. |
| R3 | career-ops prompt drift | Med | Eval quality drift | Pin upstream SHA per prompt file; quarterly diff review. |
| R4 | HuggingFace Space classifier false positives or downtime | High | Wrong job statuses or feature outage | Confidence threshold + Needs Review tab + user-corrections table; PRD §18 metric: 90% accuracy on corrected sample. Document fallback to Option B (BYO LLM classifier) if the Space becomes unreliable. |
| R5 | LAN-exposed container with default password | Med | Trust risk | README + Settings → Security warning when not running on `127.0.0.1`. |
| R6 | LLM cost surprises for users | Med | Churn | `AiAuditLog` powers a Settings → Usage page with per-day spend + soft cap warning. |
| R7 | CareerSync's Supabase code in the port creates tight coupling | Low | Slows port | Strip Supabase before integrating; only port the OAuth + parser + classifier logic. |
| R8 | `gmail.readonly` scope is sufficient | Low | Feature limits | Confirmed — read-only is all we need; no send/modify scope ever requested. |

---

## 10. Decisions (locked 2026-05-24)

| # | Decision | Locked answer |
|---|---|---|
| 1 | Auth strategy | **Option A** — keep JobSync's NextAuth credentials, one-time signup on first boot. Revisit Option B (auto-default-user) only if signup friction proves annoying in real use. |
| 2 | License | **MIT** — matches JobSync, simplest for downstream forkers. |
| 3 | Repo name + description | Name: **`CareerFlow`**. Description: **"AI-powered job application lifecycle manager. Self-hosted, local-first, BYO AI key."** |
| 4 | Resume-Matcher + OpenResume | **Defer both to Phase 5+.** JobSync's existing `/api/ai/resume/match` and structured resume builder cover MVP. Revisit only if users specifically ask for offline semantic scoring or OpenResume's PDF export quality. |
| 5 | PRD §20 open questions | **All five defaults accepted:** tailor → new resume version; Outlook → Phase 5; Ollama → first-class via JobSync's existing integration; portal scanner → opt-in; multi-account Gmail → Phase 5. |
| 6 | GitHub Container Registry | **Yes** — publish to `ghcr.io/nbjiragale/careerflow:latest` + per-version tags. No DockerHub. |
| 7 | Public demo | **Skip for v1.** Replace with a 60-second screen recording on the README. Self-host or local clone only. |
| 8 | Local dev workflow (added on review) | **Two tracks** — `npm run dev` for active dev (no Docker), `docker compose up` for self-host. Both documented in Phase 0. |
| 9 | Package manager | **Stay on npm** (JobSync's baseline). Migrate to pnpm only if explicitly requested as a separate prep PR. |

### Hard review gates (no rubber-stamp PRs)
- **Prisma migrations** — every new model / column lands in its own focused PR with the migration SQL surfaced in the PR body. Never bundled with unrelated code. Never run against any non-local DB.
- **Gmail OAuth token handling** — encrypted with the same AES+IV scheme JobSync uses for `ApiKey`; stored in a dedicated `OAuthToken` model; decrypted only inside the request that needs them; never logged, never returned to the client. Round-trip encrypt/decrypt unit test + HTTP response leakage test required.

---

## 11. Day-1 concrete next steps

In recommended order. Items I can do; items you do are flagged.

1. **You (parallel, ~30 min, non-blocking for dev):** start Gmail OAuth Cloud Project + Testing-mode submission with `gmail.readonly` scope.
2. **Devin (Phase 0):** fork `Gsync/jobsync` → `nbjiragale/CareerFlow`, push to `main`, set `upstream` remote, set up the two-track dev workflow (npm + Docker), verify both work, commit PRD + this plan to `docs/`, open Phase 1 project board. **PR #1.**
3. **Devin (Phase 1):** port CareerSync's 5 Gmail route files, add `EmailThread` + `OAuthToken` + `EmailClassificationCorrection` Prisma models in a focused migration PR, ship the Gmail tab + Needs-Review queue, wire the email processor into `node-cron`. **PRs #2 (migration) + #3 (feature).**
4. **Devin (Phase 2):** `/api/evaluate` + JD scoring UI, `/api/drafts/reply` + reply drawer, `AiAuditLog` model + Usage page. **PRs #4–#6.**
5. **Devin (Phase 3):** unified timeline, reminders, data export, account deletion, polish. **PRs #7–#9.**
6. **Devin (Phase 4):** README rewrite + 60-second screen recording + GHCR workflow + `v1.0.0` tag + GitHub Release. **PR #10.**

---

## 12. What I did NOT do this session

- **No code, no PRs, no forks created yet** — awaiting your sign-off on this revised plan.
- **No env blueprint changes** — the target repo (`nbjiragale/CareerFlow`) is empty. After Phase 0 (the JobSync fork lands), I'll update the blueprint to install Node, pnpm/npm, Docker, and run `npx prisma migrate dev` so future sessions start ready.
- **No secrets requested** — when Phase 0 starts I'll need (in order): Google OAuth Client ID/Secret (for the dev Cloud Project), and optionally an OpenAI/Anthropic key if you want me to test AI features end-to-end. All offerable as "skip / temporary / permanent" per the secret-handling guidelines.

---

*End of plan.*
