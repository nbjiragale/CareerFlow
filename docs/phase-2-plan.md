# Phase 2 — JD Evaluation + AI Reply Drafts (plan, for review)

Baseline on fresh `main` (post-Phase-1 merge): lint clean, **853 / 853 tests** passing, `next build` green. Working branch: `devin/1779645734-phase-2-jd-eval-ai-drafts`.

Per `docs/IMPLEMENTATION_PLAN.md` §4.2, §4.3, and §8 (Phase 2), this PR ships **three deliverables** as a single feature PR (with a small Prisma migration folded in — different shape from Phase 1 where the migration was a separate prior PR; small enough to keep together here).

---

## 1. Scope (locked from IMPLEMENTATION_PLAN.md)

### 1.1 JD Evaluation
- Port career-ops `oferta` (offer evaluation) prompt → `src/lib/ai/prompts/jd-evaluate/`
- `POST /api/evaluate` route returning structured A–F grade + dimension scores via Vercel AI SDK `generateObject`
- New `/dashboard/evaluate` page (paste JD, pick archetype, see scoring card)
- Score persisted on `Job`; surfaced in the existing job detail view
- Pinned upstream commit SHA `b45a8d46127fc57d8257cb026b33a75f2e9c40d0` (career-ops `modes/oferta.md` as of 2026-05-15) in `evaluate.v1.ts` so future drift is auditable (PRD §14 / R3 mitigation)

### 1.2 AI Reply Drafts
- `POST /api/drafts/reply` route with intent ∈ `{reply, follow-up, thank-you, confirm}`
- New `AiDraft` Prisma model
- Drawer UI accessible from each Gmail thread row (existing Phase 1 surface). **No autonomous send** — PRD §9.5 hard constraint. "Copy" + `mailto:` buttons only.

### 1.3 Usage tracking
- New `AiAuditLog` Prisma model
- Every `/api/evaluate` and `/api/drafts/reply` call writes one row (provider, model, tokens, cost-est, ms-elapsed)
- New `Settings → Usage` panel listing per-day spend + total counts
- Soft cap warning (banner only — non-blocking) when daily spend exceeds a user-configurable threshold (`UserSettings.settings.usage.dailyCapUsd`, default unset)

---

## 2. Design decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | LLM call infra | Use the existing `provider-registry.server.ts` + `getModel()` + Vercel AI SDK `generateObject` | JobSync already routes all AI through this; reusing it gets us OpenAI, Gemini, DeepSeek, OpenRouter, and Ollama for free. |
| D2 | Schema migration in same PR as feature? | **Yes — folded in** (3 column additions on `Job`, 2 new models) | Phase 1 split mig + feature into 2 PRs because the migration was already drafted ahead of the feature. Here the delta is small and tightly coupled to the feature — splitting just doubles review overhead. |
| D3 | career-ops prompt provenance | Port `modes/oferta.md` + `modes/_shared.md` (scoring rubric + archetype list) into a single self-contained system prompt; capture **upstream SHA** in a `SOURCE_SHA` constant. | PRD §14 (R3) — pinned SHA lets us diff against upstream every quarter without surprises. |
| D4 | Career-ops blocks dropped offline | **Drop Block G (legitimacy)** entirely; **soften Block D (comp/demand)** to "model's best estimate; user should verify externally" | Block G needs Playwright + WebSearch (Claude Code tools we don't have). Block D needs WebSearch for current salary data; without it, output is just stale training data. Better to be honest than fabricate. |
| D5 | Grade calculation | Map 1–5 global score → A–F: **4.5+ = A, 4.0–4.4 = B, 3.5–3.9 = C, 3.0–3.4 = D, <3.0 = F** | Direct from `_shared.md` lines 41–46; rounded to letter on backend so UI can't drift. |
| D6 | Archetype set | Six fixed archetypes from career-ops `_shared.md`: `ai-platform-llmops`, `agentic`, `ai-pm`, `solutions-architect`, `forward-deployed`, `transformation`. Plus `auto-detect` UI option. | Direct port; user picks one (or auto-detect) and the LLM uses it as a framing hint. Output also includes the model's own detected archetype which may differ. |
| D7 | Reply draft intents | Four intents: `reply`, `follow-up`, `thank-you`, `confirm`. Plan §4.3 lists three; I'm adding `confirm` (e.g., "yes, that time works") since it's a common need and trivial to add. | If you'd rather stick to three, drop a comment and I'll cut `confirm`. |
| D8 | Reply draft context | Pulls (a) the `EmailThread` row, (b) the user's most-recent resume summary via existing `Resume.parsed` field, (c) the linked `Job` (company, role, status) | Same shape as career-ops `apply` mode. The thread's full body is NOT stored per Phase 1 PRD §13 — we re-fetch the body from Gmail at draft time using the existing Phase 1 `body.ts` helper. |
| D9 | Audit cost estimation | Track `provider`, `model`, `promptTokens`, `completionTokens`, `costUsd` (computed from a small per-model rate table baked into `src/lib/ai/pricing.ts`). Ollama → cost 0. | Vercel AI SDK returns usage `{ promptTokens, completionTokens, totalTokens }` for every paid provider; pricing table is just a static `Record<model, {input, output}>` map. |
| D10 | Usage page UX | Settings → Usage panel: 30-day chart (calls/day, $/day), top-N models, optional soft cap input | Matches PRD R6 ("LLM cost surprises"). The soft cap is just a warning banner — never blocks the request. |
| D11 | Rate limiting | Reuse existing `checkRateLimit(userId)` from `src/lib/ai/rate-limiter.ts` (in-memory, 10 req/min) | Already used by other AI routes; no new infra. |
| D12 | Where evaluation surfaces on Job detail | Render an **EvaluationCard** at the top of `/dashboard/myjobs/[id]` showing grade + 5 dimension scores + collapsible blocks (Role Summary / Match / Strategy / Comp / Customization / Interview Plan / Keywords) | Existing job detail page has space; this is the natural home so the user re-discovers it after the eval ran. |
| D13 | Re-evaluation | "Re-evaluate" button on Job detail overwrites `evaluationJson` and bumps `evaluatedAt`. No history kept. | Storage savings; users can re-run on demand. If you want history, say so and I'll persist into `EvaluationHistory[]`. |

---

## 3. Files to add

### `src/lib/ai/prompts/jd-evaluate/`
- `system.ts` — system prompt ported from career-ops `modes/oferta.md` + `modes/_shared.md`. Includes scoring rubric, archetype detection rules, 6-block output structure (A, B, C, D-soft, E, F). Marked with `SOURCE_SHA` constant.
- `user.ts` — `buildJdEvaluatePrompt({ jdText, archetypeHint, resumeSummary })` helper.
- `index.ts` — barrel.

### `src/lib/ai/prompts/reply-draft/`
- `system.ts` — system prompt for the 4 intents; instructs the model to produce ONLY the email body (no subject line, no signature).
- `user.ts` — `buildReplyDraftPrompt({ thread, body, resumeSummary, job, intent })`.
- `index.ts`.

### `src/lib/ai/`
- `evaluate.ts` — `runJdEvaluation({ userId, jdText, archetypeHint, resumeId? }): Promise<JdEvaluationResult>`. Uses `generateObject` against the user's configured provider/model. Writes `AiAuditLog` on success/failure.
- `drafts.ts` — `generateReplyDraft({ userId, emailThreadId, intent }): Promise<AiDraft>`. Uses `generateObject`. Persists into `AiDraft` and writes `AiAuditLog`.
- `audit.ts` — `recordAiUsage(args)` helper. Computes cost via pricing.ts.
- `pricing.ts` — static `MODEL_PRICING_USD_PER_1M_TOKENS: Record<string, { input: number; output: number }>` for the major paid models. Unknown model → cost 0 + a `_warning` field.
- `usage.ts` — `getUsageSummary(userId, days)` aggregator.

### `src/models/ai.schemas.ts` (existing file — add new schemas)
- `JdEvaluationSchema` (Zod). Shape:
  ```ts
  {
    detectedArchetype: "ai-platform-llmops" | "agentic" | ... | "hybrid",
    hybridArchetypes?: [Archetype, Archetype],
    grade: "A" | "B" | "C" | "D" | "F",
    globalScore: number,                  // 1.0-5.0
    dimensionScores: {
      matchWithCv: number,                // 1-5
      northStarAlignment: number,
      comp: number,
      culturalSignals: number,
      redFlags: number,
    },
    blocks: {
      roleSummary: string,
      matchWithCv: string,
      levelStrategy: string,
      compDemand: string,                 // soft / advisory
      customizationPlan: string,
      interviewPlan: string,
    },
    keywords: string[],                   // 15-20 ATS keywords
  }
  ```
- `AiReplyDraftSchema` — `{ subject?: string; body: string; tone: string }`

### `src/app/api/`
- `evaluate/route.ts` — `POST` only. Auth + rate limit + body validation (Zod) + `runJdEvaluation` + (optionally) persist on `Job` if `?jobId=` supplied.
- `drafts/reply/route.ts` — `POST`. Auth + rate limit + `generateReplyDraft`. Returns `{ draft }`.
- `usage/route.ts` — `GET ?days=N`. Returns aggregated stats from `AiAuditLog`.
- `drafts/route.ts` — `GET ?emailThreadId=` returns past drafts for a thread (so the drawer can show history).

### `src/app/dashboard/evaluate/page.tsx`
Server component shell. Renders `<EvaluatePanel />`.

### `src/components/evaluate/`
- `EvaluatePanel.tsx` — JD textarea + archetype picker + "Evaluate" button + result card.
- `EvaluationCard.tsx` — displays grade + dimension scores + collapsible blocks. Reused in `/dashboard/myjobs/[id]` and `/dashboard/evaluate`.
- `ArchetypePicker.tsx` — combo box with the six archetypes + "auto-detect".

### `src/components/gmail/`
- `DraftReplyDrawer.tsx` — opens from `GmailThreadRow`; intent radio + "Generate" button + editable textarea + "Copy" / "Open in mail client" buttons.

### `src/components/settings/`
- `UsageSettings.tsx` — bar chart + day-by-day table + soft-cap input.

### `__tests__/`
- `evaluate.spec.ts` — mock provider, assert audit row + persistence
- `drafts.spec.ts` — mock provider, assert audit row + AiDraft row
- `audit.spec.ts` — pricing + token math
- `usage.spec.ts` — aggregation correctness
- `evaluate-route.spec.ts` — auth, validation, rate-limit, persistence, error paths
- `drafts-reply-route.spec.ts` — same shape
- `drafts-route.spec.ts` — GET history
- `usage-route.spec.ts` — query param + aggregation
- `pricing.spec.ts` — known + unknown models + Ollama
- `jd-evaluate-prompt.spec.ts` — snapshot the system prompt body (catches accidental prompt edits)
- `reply-draft-prompt.spec.ts` — same

Target: **35–45 new tests**, suite goes from 853 → ~895.

---

## 4. Files to modify (every modification gets a `// CAREERFLOW:` comment)

- `prisma/schema.prisma` — add Job columns + AiDraft + AiAuditLog models. New migration name: `careerflow_phase_2_eval_drafts_audit`.
- `src/lib/constants.ts` — add `Evaluate` icon + `SIDEBAR_LINKS` entry (right after Gmail).
- `src/components/settings/SettingsSidebar.tsx` — add `"usage"` section.
- `src/app/dashboard/settings/page.tsx` — wire `UsageSettings`.
- `src/app/dashboard/myjobs/[id]/page.tsx` (or whichever component owns the detail layout) — render `EvaluationCard` when `job.evaluationJson` is set, plus a "Re-evaluate" button.
- `src/components/gmail/GmailThreadRow.tsx` — add "Draft reply ▾" button opening `DraftReplyDrawer`.
- `src/lib/api-key-resolver.ts` (read-only audit) — confirm it's the entry point used by the new routes; reuse without modification.

---

## 5. Out of scope (this PR)

- Block G (posting legitimacy) — needs Playwright/WebSearch, dropped per D4.
- Real-time WebSearch for comp data — dropped per D4; Block D becomes advisory.
- Resume tailoring autopilot — the eval surfaces a "customization plan" *paragraph* but doesn't auto-write a new resume.
- Outreach generator (career-ops `contacto` mode) — Phase 5+ per plan §8.
- Interview-prep doc generation (career-ops `interview-prep` mode) — Phase 5+.
- A separate "Drafts library" page — drafts are accessible per-thread via the drawer + `GET /api/drafts?emailThreadId=` for now.
- Streaming responses — `generateObject` is one-shot. Streaming would be a nice polish but isn't required.

---

## 6. Risks I'm tracking

| # | Risk | Mitigation |
|---|---|---|
| P2-R1 | LLM returns malformed JSON for the eval and `generateObject` retries waste tokens | Vercel AI SDK has a built-in `maxRetries=2` and falls back to a parse error; we surface a clean 502 to the UI with "Try again or switch model" |
| P2-R2 | Prompt overflows context window for short-context models (e.g. cheap Ollama models) | Truncate JD to 8k chars + resume summary to 2k chars on the way in; document it as a limitation in `.env.example` |
| P2-R3 | Cost estimate is wrong for newly-released models we don't know about | `pricing.ts` returns `{ costUsd: 0, _warning: "Unknown model" }` so the usage tab still records the call, just without a $ figure |
| P2-R4 | "Draft reply" surfaces a tone that's off for the recipient (recruiter vs hiring manager vs auto-bot) | Pass the `fromAddress` to the prompt as a tone hint; user can edit before copying. Output is always editable. |
| P2-R5 | Re-evaluation on the same JD silently overwrites the old result | Acceptable per D13; if you want history say so and I'll add a `JobEvaluationHistory` table |

---

## 7. Two things I'd like your sign-off on before coding

1. **Schema migration folded into this PR (D2).** OK to ship the migration in the same PR? If not, I'll split it into a separate small PR first, then the feature PR (same flow as Phase 1).
2. **Block G (legitimacy) dropped + Block D (comp/demand) softened (D4).** Both blocks in career-ops require live web access (Playwright + WebSearch) that CareerFlow doesn't have. My proposal: drop G, keep D but flag it as "model's recollection, verify externally". Alternative: keep both as TODO stubs that say "requires browser plugin" until a future phase. Your call.

If both of those are fine I'll start implementing immediately. Next message from me will be the PR link.
