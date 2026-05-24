# CareerFlow AI — Product Requirements Document

**Version:** 2.0 (Integration-First Edition)
**Status:** Draft
**Owner:** Niranjan
**Last Updated:** May 24, 2026

---

## 1. Vision

CareerFlow AI is an open-source, self-hostable, AI-powered job application lifecycle platform that unifies Gmail tracking, application management, resume tailoring, ATS scoring, and recruiter communication into a single workflow-driven dashboard.

**Core philosophy:** Don't rebuild what already exists. Integrate proven open-source projects, add a thin orchestration layer, and ship a unified experience.

**User cost:** Zero. The only configuration required is the user's own AI API key.

---

## 2. Problem Statement

Job seekers manage their search across Gmail, spreadsheets, Notion, LinkedIn, job portals, multiple resume versions, calendars, and notes. This fragmentation causes lost recruiter emails, missed follow-ups, duplicate applications, resume confusion, and application fatigue.

Existing tools solve isolated slices of this problem. None offer end-to-end lifecycle visibility combined with intelligent Gmail integration, AI-assisted communication, and ATS-optimized resume tailoring — for free, with full user data ownership.

---

## 3. Goals

### Primary
- Centralize the entire job application lifecycle in one dashboard
- Automatically track recruiter communication via Gmail integration
- Provide AI-assisted resume tailoring and reply drafting
- Score applications and resumes against job descriptions
- Run completely free for end users (BYO AI key model)

### Secondary
- Enable self-hosting for data privacy
- Provide application analytics and insights
- Support multiple resume versions per role

---

## 4. Non-Goals

- Auto-applying blindly to hundreds of jobs
- Replacing human judgment in job selection
- Enterprise ATS integration (initial release)
- Mobile app (initial release)
- Social/networking features
- Becoming a generic AI chatbot

---

## 5. Target Users

### Primary
- Software engineers actively job-hunting
- Experienced professionals running structured searches
- Career-switchers managing high application volumes

### Secondary
- Students preparing for first roles
- Freelancers tracking client opportunities

---

## 6. Strategic Approach — Integration Over Construction

CareerFlow AI is **not** built from scratch. It is an orchestration layer over four production-grade open-source projects, plus a thin custom dashboard and API layer.

### Why this approach
- **Time to market:** weeks instead of months
- **Quality:** leverages projects with proven user bases and battle-tested code
- **Maintenance:** upstream improvements flow into CareerFlow automatically
- **Cost:** zero infrastructure cost on free tiers

### The trade-off
- Forking discipline is required — keep customizations isolated to avoid merge hell
- Integration surface area is larger than a monolith
- Some open-source projects (e.g., career-ops) require re-implementation, not just forking

---

## 7. Open Source Foundation

| Component | Project | Role in CareerFlow | License |
|---|---|---|---|
| Gmail sync + classification | `Tomiwajin/CareerSync` | Base for Gmail OAuth, email parsing, AI classification | Open source |
| AI job evaluation pipeline | `career-ops/career-ops` | Source of prompts/logic for scoring, CV tailoring, batch processing | Open source |
| Resume builder + parser | `xitanggg/open-resume` | Resume creation UI and ATS readability testing | Open source |
| Resume-to-JD scoring | `srbhr/Resume-Matcher` | Python microservice for semantic scoring | Apache 2.0 |
| Auth + Database + Storage | `supabase/supabase` | Self-hostable Postgres + auth + file storage | Apache 2.0 |
| Notifications | `novuhq/novu` | Multi-channel notification orchestration | MIT |
| Background jobs | `triggerdotdev/trigger.dev` | Scheduled reminders, recurring syncs | Apache 2.0 |

**Critical clarification on career-ops:** career-ops is a Claude Code CLI tool, not a web service. CareerFlow does not integrate it directly. Instead, CareerFlow extracts its skill prompts and evaluation logic, then re-implements those as web-facing API routes calling the Anthropic/OpenAI API directly.

---

## 8. High-Level Architecture

```
                          Browser (Next.js + shadcn/ui)
                                      │
                ┌─────────────────────┴─────────────────────┐
                │      Unified Dashboard Shell              │
                │      (custom — the only major UI build)   │
                └─────────────────────┬─────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
  CareerSync Module          career-ops Web Layer            OpenResume Module
  (forked)                   (custom — wraps prompts)        (forked / embedded)
        │                             │                             │
        │ Gmail OAuth                 │ Calls AI API                 │ Resume builder
        │ Email classification        │ Returns structured JSON      │ ATS parser
        │ Auto-tracking               │ Powers: evaluate, score,     │ PDF export
        │                             │   tailor, deep research      │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
                            Supabase (single source of truth)
                            • users  • applications  • timeline_events
                            • resumes  • email_threads  • reminders
                                      │
                                      ▼
                            Resume Matcher (Python sidecar)
                            JD ↔ Resume semantic scoring
                                      │
                                      ▼
                            User's AI API Key
                            (Anthropic / OpenAI / Ollama)
```

---

## 9. Module Specifications

### 9.1 CareerSync Integration Module

**Source:** Fork of `Tomiwajin/CareerSync`

**Capabilities used:**
- Google OAuth2 with read-only Gmail scope
- Email parsing pipeline
- AI classification across categories: Applied, Interview, Rejected, Offer, Next Phase, Not Job Related, Not Status Update
- Hugging Face hosted SetFit classifier and T5-small extractor (free)
- Company and role extraction from email content

**Customizations required:**
- Replace stateless model with persistent Supabase storage
- Expose classification results as webhook events for the dashboard
- Add user-controllable confidence threshold for auto-categorization
- Surface low-confidence classifications for manual review

**Data flow:**
```
Gmail → CareerSync poll job → Classifier → Supabase write → Dashboard update
```

---

### 9.2 career-ops Web Layer (Custom Build)

This is the largest custom build. career-ops cannot be integrated directly — its skill files and prompts are extracted and re-served via HTTP.

**Mode-to-endpoint mapping:**

| career-ops CLI mode | CareerFlow API route | UI surface |
|---|---|---|
| `/career-ops {paste JD}` | `POST /api/evaluate` | JD paste box → Evaluation card |
| `/career-ops scan` | `POST /api/scan` | Portal scanner page |
| `/career-ops pdf` | `POST /api/resume/tailor` | Resume tailoring drawer |
| `/career-ops batch` | `POST /api/evaluate/batch` | Bulk JD upload page |
| `/career-ops tracker` | `GET /api/applications` | Kanban / table view |
| `/career-ops apply` | `POST /api/apply/draft` | Form-fill assistant |
| `/career-ops deep` | `POST /api/research/company` | Company research drawer |
| `/career-ops contacto` | `POST /api/outreach/linkedin` | Outreach message generator |
| `/career-ops project` | `POST /api/portfolio/evaluate` | Portfolio scoring |

**Implementation pattern:**
1. Extract prompt template from career-ops skill file
2. Replace template variables with user data from Supabase
3. Call user's configured AI API
4. Parse structured JSON response
5. Persist to Supabase and return to UI

**Scoring system retained from career-ops:** A–F across 10 weighted dimensions. User can adjust weights per archetype (backend, frontend, data, ML, etc.).

---

### 9.3 OpenResume Integration Module

**Source:** Fork or embed of `xitanggg/open-resume`

**Capabilities used:**
- Resume builder UI with live preview
- React-PDF based PDF export
- Resume parser for ATS readability scoring
- Existing template library

**Customizations required:**
- Persist resume data to Supabase instead of local state
- Add "Tailor with AI" button that pipes current resume + JD into the career-ops `/api/resume/tailor` endpoint
- Multi-version support per user (base resume + per-application variants)

---

### 9.4 Resume Matcher Sidecar

**Source:** `srbhr/Resume-Matcher` deployed as a Python service

**Capabilities used:**
- Semantic JD ↔ resume scoring
- Keyword extraction
- Missing keyword suggestions

**Deployment:**
- Self-hosted on Railway / Fly.io / Render free tier
- Exposed as a single REST endpoint: `POST /score { resume_text, jd_text }`
- Returns: `{ score, matched_keywords, missing_keywords, suggestions }`

**Why a sidecar:** Resume Matcher is a Python project with heavy ML dependencies. Running it as a separate service keeps the main Next.js app slim and serverless-friendly.

---

### 9.5 AI Reply Assistant (Custom)

A thin module — pure prompt engineering on top of the AI API.

**Capabilities:**
- Draft recruiter replies
- Generate follow-up emails
- Compose thank-you notes after interviews
- Draft interview confirmations

**Hard constraint:** No autonomous sending. Every draft requires explicit user approval before any send action. MVP only generates drafts — actual sending happens via mailto link or manual copy-paste.

---

### 9.6 Unified Timeline

Each application surfaces a chronological event stream aggregated from multiple sources.

**Event sources:**
- Manual user updates
- CareerSync Gmail classification events
- career-ops evaluation events
- Resume Matcher scoring events
- Reminder triggers
- Interview scheduling

**Storage:** `timeline_events` table in Supabase with polymorphic event_type and JSON metadata.

---

### 9.7 Notifications & Reminders

**Source:** `novuhq/novu` self-hosted

**Notification types:**
- Follow-up reminders (7 days after applied, 3 days after interview)
- New recruiter email detected
- Application status change
- Interview reminder (24 hours before, 1 hour before)
- Inactivity alerts (no activity for 14 days)

---

## 10. Database Schema (High-Level)

```sql
users (
  id, email, auth_provider, ai_api_key_encrypted,
  ai_provider, preferences_json, created_at
)

applications (
  id, user_id, company_name, role, source, status,
  applied_date, jd_text, archetype, scoring_weights_json,
  evaluation_score, evaluation_json, created_at, updated_at
)

resumes (
  id, user_id, version_name, is_base, resume_json,
  pdf_url, created_at, updated_at
)

resume_application_links (
  id, resume_id, application_id, match_score,
  matched_keywords, missing_keywords
)

email_threads (
  id, user_id, gmail_thread_id, application_id,
  classification, confidence, subject, snippet, received_at
)

timeline_events (
  id, application_id, event_type, source,
  metadata_json, created_at
)

reminders (
  id, application_id, reminder_type, scheduled_for,
  status, created_at
)

ai_drafts (
  id, application_id, draft_type, content,
  sent, sent_at, created_at
)
```

---

## 11. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 + TypeScript + shadcn/ui + Tailwind | Aligns with CareerSync and OpenResume stacks |
| Backend orchestration | Next.js API routes (Node) | Lower complexity; switch to Spring Boot if scale demands |
| Database + Auth | Supabase (self-hosted or free tier) | Postgres + auth + storage in one |
| Resume scoring | Python (FastAPI wrapper around Resume Matcher) | Required by upstream |
| Background jobs | Trigger.dev or BullMQ | For reminders and Gmail polling |
| Notifications | Novu | Multi-channel (email, in-app) |
| AI | User's API key (Anthropic / OpenAI / Ollama local) | Zero cost to platform |
| Hosting | Vercel free tier (frontend) + Railway/Fly free tier (Python) | Zero cost for individual users |

**Note for backend-Java engineers:** A Spring Boot orchestration layer is an option, but the open-source projects above are all Node/TypeScript. Adding Spring Boot doubles maintenance surface for limited gain at MVP scale. Stay in the Next.js ecosystem unless a clear scale or domain reason emerges.

---

## 12. MVP Scope

### Must Have (Phase 1 — 6 weeks)
- Google OAuth login (via Supabase)
- CareerSync Gmail sync + classification
- Application tracking dashboard with status board
- Unified timeline per application
- career-ops `/api/evaluate` endpoint and UI
- Resume Matcher sidecar deployed and integrated
- AI reply draft generation (recruiter response only)
- BYO AI key configuration screen

### Should Have (Phase 2 — 4 weeks)
- OpenResume embedded resume builder
- Multi-resume version support
- `/api/resume/tailor` endpoint
- Reminder system (Novu)
- Application analytics (response rates, conversion funnel)

### Could Have (Phase 3+)
- `/api/scan` portal scanner (requires Playwright service)
- `/api/research/company` deep research
- Batch evaluation
- LinkedIn outreach generator
- Chrome extension for one-click capture

### Won't Have (initial release)
- Autonomous email sending
- Mobile app
- Multi-user / team features
- Enterprise ATS integration
- Salary negotiation assistant

---

## 13. User Flow — Golden Path

1. User signs up with Google → Supabase creates account
2. User configures AI provider (Anthropic / OpenAI / Ollama) and API key
3. User grants Gmail read-only permission → CareerSync begins sync
4. CareerSync detects job-related emails → classifies → populates `applications` table
5. Dashboard shows applications with auto-detected status, recruiter messages, and timeline
6. User pastes a JD into the Evaluate page → career-ops endpoint scores it A–F
7. User uploads or builds a resume in OpenResume module
8. Resume Matcher returns match score and missing keywords for the chosen JD
9. User clicks "Tailor with AI" → tailored resume PDF generated
10. AI reply draft suggested for new recruiter email → user reviews → copies to Gmail and sends
11. Novu sends a 7-day follow-up reminder if no response

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gmail OAuth verification can take weeks for production | Launch delay | Start verification on day one; use "Testing" mode for early users |
| AI classification false positives | Wrong status on applications | Surface confidence score; let users correct; feed corrections back |
| career-ops upstream prompt changes | Drift between CareerFlow and source | Pin to specific commit; manual prompt diff reviews quarterly |
| Resume Matcher Python dependency complexity | Deploy friction | Docker container with pinned versions; documented deploy guide |
| Free tier limits (Supabase, Vercel) | Service outage for power users | Document self-hosting clearly; offer Docker Compose all-in-one |
| User stores AI key insecurely | Key leak | Server-side encryption at rest; never log keys; rotate-friendly UI |
| Forks drift from upstream | Hard to merge improvements | Keep custom code in separate directories; document patch points |

---

## 15. Security & Privacy

- AI API keys encrypted at rest with per-user envelope encryption
- Gmail OAuth tokens encrypted at rest
- Read-only Gmail scope — never request send/modify
- Full email body stored only if user opts in; otherwise only thread metadata + classification
- User-initiated data export (JSON) and full account deletion supported
- Audit log of every AI API call (cost transparency)
- No telemetry by default; optional anonymous usage metrics behind opt-in

---

## 16. Cost Model

### For end users
- **Platform:** $0 (self-hosted or hosted free tier)
- **AI usage:** Pay only for own API consumption (typically $1–5/month for active job seekers)
- **Infrastructure:** $0 on free tiers; ~$5–10/month if exceeding limits

### For the project
- **Hosting:** Free tiers cover early adoption
- **Domain:** ~$12/year (optional)
- **No third-party paid APIs**

---

## 17. Phased Implementation Plan

### Phase 0 — Foundation (Week 1)
- Repository setup, monorepo structure decision
- Fork CareerSync, OpenResume
- Set up Supabase project (local + cloud)
- Decide auth flow

### Phase 1 — Core Loop (Weeks 2–4)
- Gmail OAuth working end-to-end
- CareerSync classifier wired to Supabase
- Application list + detail page
- AI key configuration screen

### Phase 2 — Evaluation (Weeks 5–6)
- career-ops `/api/evaluate` endpoint
- JD paste UI + scoring card
- Timeline view with classification events

### Phase 3 — Resume (Weeks 7–9)
- OpenResume embedded
- Resume Matcher sidecar deployed
- Tailor-with-AI flow

### Phase 4 — Reminders & Polish (Weeks 10–12)
- Novu integration
- Analytics dashboard
- Documentation and self-host guide

### Phase 5 — Beyond MVP
- Portal scanner (Playwright service)
- LinkedIn outreach
- Chrome extension

---

## 18. Success Metrics

### Product
- Number of applications tracked per active user
- Gmail classification accuracy (target: >90% on user-corrected sample)
- Resume tailor → application submission conversion
- Time saved vs manual tracking (user-reported)

### Engineering
- Median page load < 1.5s
- Background job success rate > 99%
- API error rate < 0.5%

### Community (if open-sourced)
- GitHub stars, forks
- Self-host adoption (download / clone metrics)
- Contributor count

---

## 19. Engineering Principles

- **Integrate, don't rebuild** — every component should map to an upstream OSS project or a thin custom layer
- **AI-assisted, not AI-dependent** — every AI action requires human approval before external effect
- **Workflow-first, not feature-first** — features serve the user's daily flow, not the tech stack
- **Modular forks** — keep customizations isolated; upstream merges should remain feasible
- **No premature scale** — modular monolith, not microservices
- **Privacy by default** — user owns data; self-hosting is a first-class deployment target

---

## 20. Open Questions

1. Should resume tailoring write back to OpenResume, or generate a one-off PDF?
2. Should we support Outlook in addition to Gmail in Phase 2 or defer?
3. Local Ollama support — first-class or community contribution?
4. Should career-ops portal scanner be opt-in given ToS concerns with job boards?
5. Multi-account Gmail (work + personal) — Phase 1 or Phase 2?

---

## 21. Appendix — Reference Repositories

- CareerSync: https://github.com/Tomiwajin/CareerSync
- career-ops: https://github.com/career-ops/career-ops (and https://github.com/santifer/career-ops)
- OpenResume: https://github.com/xitanggg/open-resume
- Resume Matcher: https://github.com/srbhr/Resume-Matcher
- Supabase: https://github.com/supabase/supabase
- Novu: https://github.com/novuhq/novu
- Trigger.dev: https://github.com/triggerdotdev/trigger.dev
