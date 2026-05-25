# CareerFlow UI Redesign — implementation plan

**Status:** plan for review — no code written yet.
**Goal:** make the live Next.js app match the provided design mockup exactly (screenshots + `styles.css` token system + standalone prototype). No design changes — we implement the mockup as-is.
**Locked decisions (this session):**
- **Scope = Re-skin + IA.** Adopt the full design system AND the mockup's information architecture/layout, using existing data. A few new pipeline statuses are added; no brand-new feature engines (resume-tailoring, board drag-and-drop, categorized-reminder engine are visual/use-existing-data only — see §7).
- **Integration = Tokens → Tailwind.** Translate the mockup's CSS tokens into the existing shadcn/Tailwind variable system and restyle components. Reuses all current React + server logic and the 1101-test suite.

Baseline: `main` after Phase 3 (PR #13). Tests 1101 green, lint clean, build green.

---

## 1. Design system foundation (the whole app shifts at once)

Source of truth: the uploaded `styles.css`.

- **Palette → `src/app/globals.css`.** Replace the shadcn `:root`/`.dark` HSL values with the mockup's tokens. Mockup uses hex/oklch; we keep shadcn's `hsl(var(--x))` mapping by storing HSL triples, OR switch the Tailwind color mapping to raw `var(--x)` hex. Recommended: store the mockup palette as the shadcn vars so every existing `bg-background`, `text-muted-foreground`, `border`, etc. instantly retargets.
  - light: `--bg #faf9f6`, `--surface #fff`, `--border #ebe9e1`, `--text #18181b`, accent indigo `#5b5cf6`.
  - dark: `--bg #0a0a0a`, `--surface #131314`, `--border #232326`, `--text #fafaf9`.
  - Add new tokens the mockup needs that shadcn lacks: `--surface-2`, `--surface-hover`, `--border-strong`, `--text-2`/`--text-subtle`, status colors (`--st-applied/interview/offer/rejected/wishlist/screening`), grade colors (`--grade-a…f`).
- **Fonts → `src/app/layout.tsx`.** Swap Inter for **Geist** + **Geist Mono** via `next/font/google` (`geist`/`geist_mono` packages already exist, or `next/font`), wire `--font-sans`/`--font-mono`, enable `font-feature-settings: "ss01","cv11"` + tabular nums.
- **Radii / density.** Map `--radius` to the mockup's scale; add the `data-density` (compact/comfortable) hook + a setting in Settings → Appearance.
- **Dark mode.** Mockup ships both themes; the app already has `darkMode: ["class"]` + a theme setting. Wire the topbar dark-mode toggle to it; verify both themes against the screenshots.

Deliverable: app-wide visual shift with zero structural change yet. One focused PR.

---

## 2. Component layer (restyle shadcn + add mockup primitives)

Restyle existing shadcn components to the mockup look (Button variants incl. `btn-accent`/`btn-primary` dark pill, Card, Input/search-shell with ⌘K hint, Badge→`pill`, Tabs, Dialog/Sheet, Slider, Switch).

New primitives to add (`src/components/ui/` or `src/components/design/`):
- **Pill / status pill** (`pill-applied`, `pill-interview`, …) — status chips.
- **Grade chip** (`grade-a…f`, mono, rounded) — the A–F evaluation badge.
- **Segmented control** (`seg`) — Board/Table, 7d/30d toggles.
- **Match bar** — the thin colored progress bar + `NN%` used on app cards and resume rows.
- **Sparkline** — tiny line chart on dashboard stat cards (Nivo line or a lightweight SVG).
- **Logo-mark** — company initial tile (`logo-mark` sizes xs/sm/lg).
- **Shell** — `Sidebar` (232px, sections + collapse) + `Topbar` (crumbs, Sync Gmail, bell, dark toggle, +Add, avatar) + sidebar footer ("Connected · Gmail", "AI · <provider/model> · $<30d spend>").

---

## 3. Information architecture / navigation

Rework the sidebar + routes to the mockup (`src/lib/constants.ts` SIDEBAR_LINKS + route folders). The app keeps its data/actions; mostly relabels + relocates UI.

| Mockup nav | Current route | Action |
|---|---|---|
| Dashboard | `/dashboard` | restyle |
| Applications (count) | `/dashboard/myjobs` | rename label → "Applications"; board+table |
| Inbox (count) | `/dashboard/gmail` | rename label → "Inbox"; restyle |
| **AI TOOLS** group | — | new sidebar section header |
| Evaluate JD | `/dashboard/evaluate` | restyle |
| Resumes | `/dashboard/profile` (resume area) | surface a Resumes list view |
| Reminders | `/dashboard/tasks` (+ Phase 3 reminders) | Reminders view |
| Settings (footer) | `/dashboard/settings` | move to sidebar footer |

Keep existing routes working (Automations, Activities, Question Bank, Admin, Profile) — either fold into the new IA or keep accessible; mockup doesn't show them, so they stay reachable but de-emphasized (decide per-page during build).

---

## 4. Page-by-page (exact content from the screenshots)

1. **Shell** — sidebar + topbar + footer (above).
2. **Dashboard** — "MONDAY · MAY 25" eyebrow, "Good morning, {name}" greeting, reminders/offer summary line, Export + "Evaluate a JD" buttons; 4 stat cards with sparkline + delta: **Active**, **Applied (30d)**, **In interview**, **Response rate**. (Maps to existing dashboard actions + the Phase 3 tiles.)
3. **Applications** — Board/Table toggle, search, role chips (All/Frontend/Backend/Fullstack/ML), Filters, Sort; Kanban columns per stage (Wishlist/Applied/Screening/Interview/Offer/Rejected) with count + add; cards show logo-mark, role, company · location, match bar + %, source + age, star.
4. **Application detail** — back link, Re-evaluate / Open JD / ⋯; header stat trio (AI GRADE / SCORE / RESUME match), company header with status pills + meta; tabs **Overview / Timeline (n) / Emails (n) / Resume match / Job description**; AI Evaluation card with per-dimension bars + grades (Technical fit 18/20, Domain experience 12/15, …) + Weights.
5. **Inbox** — restyle of the Gmail threads view to the mockup card/pill style.
6. **Evaluate JD** — archetype dropdown (e.g. "Backend / Infra"), "Load sample JD", "Scoring weights"; JD textarea card with char count + clear; auto-detect role/location/salary/stack line; scoring output card with grade + dimension bars.
7. **Resumes** — "N versions · 1 base, M tailored · used across K applications", All/Base/Tailored filter, "Open builder" + "Tailor for a JD"; rows: thumbnail, title, filename · edited, tags, ATS/MATCH %.
8. **Reminders** — "0/12 done this week · N urgent", category chips (Follow-up/Prep/Decision/Thank-you/Outreach/Interview), progress card (DONE/PENDING/URGENT), Today/Tomorrow grouping, row with icon, title, company, deadline note, time, ⋯; "Notification rules" + "New reminder".
9. **Settings** — sidebar-style sections in the new look (AI Provider / API Keys / Integrations / Usage / Notifications / Data / Account / Appearance), Appearance gains theme + density.

---

## 5. Data / schema touchpoints (no Prisma migration)

- **Statuses.** Extend `JOB_STATUSES` in `src/lib/constants.ts` to the board's 6 stages (add `wishlist`, `screening`). `JobStatus` rows are seeded (not a schema change) — update the signup seed + add a one-time upsert so existing users get the new rows. Board columns map 1:1 to `JobStatus.value`; legacy `draft/expired/archived` remain selectable.
- **Match scores.** `Job.matchScore`/`matchData` already exist → drive the card match bars.
- **AI grade/score.** `Job.evaluationGrade`/`evaluationJson` already exist → drive the detail header + dimension bars.
- **AI spend footer.** Reuse `getUsageSummary(userId, 30)` for the "$X.XX" + provider/model.

---

## 6. Sequencing (PRs)

1. **PR A — Design foundation:** tokens in `globals.css`, Geist fonts, density, dark-mode parity, Tailwind var remap. (App restyles globally; no structure change.)
2. **PR B — Shell + primitives:** Sidebar/Topbar/footer, pill/grade/seg/match-bar/sparkline/logo-mark, restyled Button/Card/Input/Badge/Tabs. IA/nav relabel.
3. **PR C — Dashboard + Applications (board+table) + detail.**
4. **PR D — Evaluate JD + Inbox.**
5. **PR E — Resumes + Reminders + Settings (Appearance density).**
6. **PR F — Status reconciliation + seed + polish + screenshot-diff pass.**

Each PR keeps tests/lint/build green. Snapshot/DOM tests that assert old markup get updated alongside.

---

## 7. Explicitly NOT in this scope (visual-only / existing data)
- **Resume tailoring engine** — the Resumes page renders existing resume data + match %; generating tailored variants is a later feature.
- **Board drag-and-drop** — columns render by status; moving a card updates status via the existing action, but fancy DnD polish is deferred.
- **Categorized-reminder engine** — Reminders view groups existing tasks/reminders; the category taxonomy is presentational unless we later persist it.
- **New AI features** — none; we reuse evaluate/match/usage as-is.

---

## 8. Risks
- **Exact-match fidelity** — the mockup is bespoke CSS; mapping into Tailwind/shadcn may drift on spacing/shadows. Mitigation: build a `/dashboard/developer`-style "style guide" page and diff against screenshots per PR.
- **Test churn** — component/markup changes will break DOM-assertion tests (e.g. settings sidebar labels, JobDetails). Update them within each PR; keep logic tests intact.
- **Dark mode + density** — two themes × two densities = 4 combos to verify against the mockup.
- **Mobile/responsive** — screenshots are desktop; preserve the existing responsive behavior, define breakpoints per page.
- **IA relabeling** — renaming routes/labels must not break deep links (Gmail callback `?section=`, etc.).

---

## 9. Things I may need from you
- **Brand mark / favicon** — the "C" logo tile + "CareerFlow BETA" wordmark: keep the CSS mark as-is (no asset needed) unless you have an SVG/logo + favicon you want used.
- **Confirm the 6 board stages** and how legacy `draft/expired/archived` should appear (hidden, or as extra columns/filters).
- Otherwise: **no external assets needed** — Geist is on Google Fonts and lucide icons (already a dependency) match the mockup's icon set.

---

## 10. Exit criteria
Each redesigned page visually matches its screenshot in both light and dark themes; nav/IA matches the mockup; existing features still work; suite + lint + build stay green.

---

*End of redesign plan.*
