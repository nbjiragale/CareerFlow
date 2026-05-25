# Phase 3 — PR #9 plan: data export + account deletion + analytics tiles

**Status:** plan for review — no code written yet.
**Branch:** `claude/phase-3-review-4i2kN` (continues Phase 3).
**Predecessors:** PR #7 (schema migration — merged), PR #8 (timeline + reminders + notifications — pushed). This PR closes out Phase 3 §1.3, §1.4, §1.5 from the Phase 3 analysis.

Baseline after PR #8: **1071 / 1071 tests** passing, lint clean, `next build` green.

> **No Prisma migration in this PR.** Every deliverable reads or deletes *existing* tables. The cascade rules that make account deletion safe already landed in PR #7. This keeps the §10 hard gate intact — PR #9 is feature-only.

---

## 1. Scope

### 1.1 Data export (§1.3)
- New endpoint `GET /api/settings/data-export` returning a single JSON blob of every row scoped to the current user, with `Content-Disposition: attachment; filename="careerflow-export-YYYY-MM-DD.json"`.
- Shape: one top-level key per table plus a `_meta` block:
  ```jsonc
  {
    "_meta": {
      "exportedAt": "2026-05-25T…Z",
      "schemaVersion": "phase-3",
      "userId": "…",
      "note": "Secrets (API keys, OAuth tokens) are redacted. Server env vars are never exported."
    },
    "user": { … },
    "jobs": [ … ],
    "emailThreads": [ … ],
    // …every user-owned table
  }
  ```
- New UI: Settings → **Data** panel (`DataExportSettings.tsx`) with a "Download my data (JSON)" button.

### 1.2 Account deletion (§1.4)
- New endpoint `POST /api/settings/delete-account` with body `{ confirmEmail }`.
- Hard-confirmation flow: the user must **re-type their account email**; the button stays disabled until it matches.
- Deletion is a single `prisma.user.delete({ where: { id } })` — PR #7's `onDelete: Cascade` on every User-owned FK wipes the dependent rows transactionally. Global lookups (`JobStatus`) are not user-owned and remain.
- After a successful delete the client calls NextAuth `signOut()` and redirects to `/signin`.
- New UI: Settings → **Account** panel (`DeleteAccountSettings.tsx`) — destructive zone, type-to-confirm.

### 1.3 Dashboard analytics tiles (§1.5)
- `ResponseRateTile.tsx` — of `Applied`-classified `EmailThread`s, the % whose job later saw an `Interview`/`Offer`/`NextPhase` thread within 30 / 60 / 90 days.
- `FunnelTile.tsx` — Applied → Interview → Offer counts (Nivo `Bar`, already a dep).
- `AiSpendTile.tsx` — last-30-day spend, reusing Phase 2's `getUsageSummary(userId, 30)`.
- All three render on `/dashboard` with empty-state fallbacks.

---

## 2. Design decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| D14 | **Export of encrypted secrets** (resolves the open D9 question) | **Redact secret material entirely.** Export non-sensitive metadata only — `ApiKey`: `provider, last4, label, timestamps` (never `encryptedKey`/`iv`); `OAuthToken`: `provider, email, scope, timestamps` (never the encrypted tokens/IVs). Mark each with `_encrypted: true`. Never export the master key or `process.env`. | A backup/portability file may be emailed or synced to cloud storage. Even ciphertext is needless attack surface and is useless off the origin server (no import yet). Redaction is the honest, safe default. *Alternative for sign-off:* export ciphertext+IV for a future same-server restore — defer unless import lands.|
| D15 | Export scoping strategy | **Per-table queries with a centralized ownership map** (`userId` vs `createdBy` vs relation-walk for resume sub-tables). | Explicit and auditable; avoids a fragile mega `include`. The map lives next to the cascade graph PR #7 already encodes. |
| D16 | Export delivery | **Buffered JSON `Response`** (not streamed) for v1. | Local-first datasets are small (hundreds of rows). Streaming/NDJSON is a Phase 5 optimization if needed. |
| D17 | Funnel data source | **`Job.Status.value`** (`applied`/`interview`/`offer`), not email labels. | The job tracker's pipeline is the user's authoritative state; email labels feed response-rate instead. |
| D18 | Response-rate definition | Group `EmailThread` by `jobId`; an `Applied` thread "got a response" if the same job has an `Interview`/`Offer`/`NextPhase` thread with `receivedAt` within the window. Threads with no `jobId` are excluded. | Measures recruiter responsiveness, the metric §1.5 asks for; cleanly per-user via `userId`. |
| D19 | Deletion confirmation | **Re-type email** (case-insensitive compare) server-side AND client-side gate. | PR #7's mitigation P3-R1; prevents accidental wipes. |
| D20 | Deletion idempotency | If the user row is already gone, return `200` (no-op). | Safe to retry; avoids a confusing 404 after a successful delete. |
| D21 | Tile data layer | New `getResponseRateForUser`, `getFunnelForUser` in `dashboard.actions.ts`; AI spend reuses `getUsageSummary`. | Keeps the action layer thin and unit-testable, matching existing dashboard actions. |

---

## 3. Database schema delta

**None.** All tables/columns/cascade rules exist as of PR #7. No `prisma migrate`.

---

## 4. Files to add / modify

**New:**
- `src/lib/export/collect.ts` — `collectUserExport(userId)`: builds the `{ _meta, …tables }` object using the ownership map + secret redaction. Pure-ish (db in, object out) → unit-testable.
- `src/app/api/settings/data-export/route.ts` — auth + `collectUserExport` + attachment headers.
- `src/app/api/settings/delete-account/route.ts` — auth + email confirmation + `prisma.user.delete`.
- `src/components/settings/DataExportSettings.tsx`
- `src/components/settings/DeleteAccountSettings.tsx`
- `src/components/dashboard/ResponseRateTile.tsx`
- `src/components/dashboard/FunnelTile.tsx`
- `src/components/dashboard/AiSpendTile.tsx`

**Modified (each gets a `// CAREERFLOW: Phase 3 —` marker):**
- `src/actions/dashboard.actions.ts` — add `getResponseRateForUser`, `getFunnelForUser`.
- `src/components/settings/SettingsSidebar.tsx` — add `"data"` and `"account"` sections.
- `src/app/dashboard/settings/page.tsx` — wire the two new panels + `?section=` deep-link.
- `src/app/dashboard/page.tsx` — render the three tiles.

---

## 5. Test plan (target ~25 new tests; suite 1071 → ~1096)

| File | Tests |
|---|---|
| `__tests__/export-collect.spec.ts` | builds `_meta`; includes every table key; redacts `ApiKey.encryptedKey`/`iv` and `OAuthToken` secrets while keeping metadata; per-user scoping |
| `__tests__/data-export-route.spec.ts` | 401 unauth; 200 returns scoped JSON; `Content-Disposition` attachment header; never leaks secrets |
| `__tests__/delete-account-route.spec.ts` | 401 unauth; 400 on email mismatch; calls `user.delete` on match; idempotent when already gone |
| `__tests__/dashboard-response-rate.spec.ts` | 30/60/90 window math; ignores threads with no `jobId`; per-user scoping; zero-applied → 0% (no divide-by-zero) |
| `__tests__/dashboard-funnel.spec.ts` | counts per stage from `Job.Status`; handles missing stages (→ 0); per-user scoping |
| `__tests__/dashboard-tiles.spec.tsx` | render tests: each tile shows data and its empty state |

Deletion cascade is already covered by PR #7's `phase-3-cascade-integration.spec.ts` (real temp-SQLite); the route test mocks `prisma.user.delete` and asserts orchestration only.

---

## 6. Out of scope
- **Export → import round-trip** (import is Phase 5+).
- **Zip/NDJSON streaming** of the export (D16).
- **Decrypt-on-export** of secrets (D14 alternative) — only if a same-server restore feature is greenlit.
- **Soft-delete / account recovery** — deletion is hard, per the PRD.
- **Per-tile date-range pickers** — fixed windows for v1.

---

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| P3-R1 (carried) | Cascade delete wipes the wrong data | Type-to-confirm UI + server-side email check (D19); existing cascade integration test asserts a sibling user's rows survive |
| P3-R3 (carried) | Secrets leak via the export file | Redact all ciphertext/IVs and never read `process.env`; `_encrypted: true` markers (D14); route test asserts no secret columns appear |
| P3-R8 (new) | A new table is added later but missed by the export | Centralized ownership map + a test that fails if a user-owned model has no export entry (keep the map and the model list in sync) |
| P3-R9 (new) | Response-rate divide-by-zero / off-by-one on window edges | Guard zero-applied → 0%; inclusive `<=` window; unit tests pin 30/60/90 boundaries |

---

## 8. Exit criteria (closes Phase 3 §9)
1. Settings → **Data** → "Download my data" returns a JSON file containing every seeded row, with secrets redacted and a `_meta` block.
2. Settings → **Account** → typing the wrong email keeps the delete button disabled; typing the correct email and confirming drops the user's row count to zero and signs out.
3. `/dashboard` shows the three tiles populated from seeded demo data, each with a sensible empty state when there's no data.
4. 1071 → ~1096 tests passing, lint clean, `next build` green.

---

## 9. One thing to sign off before coding
**D14 — export of encrypted secrets.** Plan recommends **full redaction** (metadata only, no ciphertext, no master key). The alternative (export ciphertext+IV for a hypothetical same-server restore) is deferred until an import feature exists. Confirm redaction is acceptable, or say if you'd rather keep ciphertext.

---

*End of PR #9 plan.*
