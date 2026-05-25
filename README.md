<!-- CAREERFLOW: start CareerFlow header block (entirely CareerFlow-added content; no JobSync original above this section). -->
# CareerFlow AI

> AI-powered job application lifecycle manager. Self-hosted, local-first, BYO AI key.

CareerFlow AI is an open-source, self-hostable platform that unifies Gmail tracking, application management, resume tailoring, ATS scoring, and recruiter communication into a single workflow-driven dashboard. Zero infrastructure cost — the only configuration required is your own AI provider key.

**Status:** Phases 1–3 shipped. Phase 4 (release prep — `NOTICE`, self-hosting docs, GHCR publish workflow, v1.0.0 tag) in progress. See [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) for the full roadmap and [`docs/PRD.md`](./docs/PRD.md) for the product spec.

## What's shipped

CareerFlow inherits everything from JobSync (application tracker, resume builder, AI resume review, AI job match — see the JobSync section below) and adds, on top:

- **Gmail integration** (Phase 1) — OAuth-based connect flow, 15-minute background sync via `node-cron`, encrypted token storage, automatic classification of recruiter / interview / rejection / offer threads. Single-account, read-only scope.
- **JD evaluation** (Phase 2) — paste any job description, pick an archetype hint or auto-detect, get a structured 0–5 rubric with strengths, gaps, and an A–F grade. Persists onto the linked `Job` row for at-a-glance scoring on the Applications board.
- **Reply-draft generator** (Phase 2) — generate intent-aware (`confirm` / `decline` / `clarify` / `thank-you`) recruiter reply drafts from a Gmail thread. Drafts are stored locally, never auto-sent. History per thread.
- **Activity timeline & reminders** (Phase 3) — per-application timeline aggregating Gmail events, evaluation, drafts, and status changes; reminder banners surface high-priority threads needing your attention.
- **Multi-provider AI** — Ollama (local, default), OpenAI, DeepSeek, Google Gemini, OpenRouter. Configured in Settings → AI Provider. Costs and per-call usage logged to Settings → Usage.
- **Reliability fallback** — when a model returns prose instead of JSON or a provider rejects our schema constraints (Gemini's `minItems` / `maxItems` / `minimum` / `maximum` restrictions, some OpenRouter proxies), we transparently retry via plain `generateText` with the JSON Schema injected into the prompt. Real auth, quota, and transport errors still surface as-is in Settings → Usage.
- **Export & delete** — full JSON export of your data and a one-click "delete everything" flow in Settings.

## Built on

CareerFlow is an orchestration layer over excellent existing open-source projects. We integrate rather than reconstruct:

- **[Gsync/jobsync](https://github.com/Gsync/jobsync)** (MIT) — the base application: Next.js + Prisma + SQLite dashboard, AI key management, structured resume builder, AI resume↔JD matching, and the `node-cron` scheduler. CareerFlow extends this with Gmail integration, JD evaluation, and recruiter reply drafting.
- **[Tomiwajin/CareerSync](https://github.com/Tomiwajin/CareerSync)** (MIT) — Gmail OAuth flow and email processing pipeline (Gmail message fetching + a remote HuggingFace Space classifier via the `@gradio/client` API) ported in as Next.js API routes. Regex is used only for exclusion filtering (e.g. `*@indeed.com`), not for classification.
- **[career-ops](https://github.com/career-ops/career-ops)** — source of evaluation, tailoring, and outreach prompts. Re-implemented as web-facing API routes that call your configured AI provider.
- **[srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher)** (Apache 2.0) — deferred; planned as an optional Python sidecar for offline semantic scoring in a later phase.

Full attribution and license info in [`NOTICE`](./NOTICE) (TBA — Phase 4).

---

## Original JobSync README below

The sections below are the unmodified JobSync README except where a `<!-- CAREERFLOW: ... -->` marker calls out a specific edit. Use this as supplementary reference for the inherited functionality (application tracker, resume builder, AI resume review, AI job match); CareerFlow-specific functionality is documented in the "What's shipped" section above.
<!-- CAREERFLOW: end CareerFlow header block; everything below is the upstream JobSync README with marked edits. -->

<!-- CAREERFLOW: appended "(JobSync)" to the heading so readers know the demo is the upstream project, not CareerFlow. -->
## <a href="https://demo.jobsync.ca">Live Demo (JobSync)</a>

JobSync is a web app companion for managing your job search journey. This free and open-source project is designed to help job seekers efficiently track and organize their job applications. Say goodbye to the chaos of scattered information and hello to a streamlined, intuitive, and powerful job search experience running locally on your system.

Job searching can be overwhelming, with numerous applications to track and deadlines to meet. JobSeeker Assistant is here to simplify this process, allowing you to focus on big picture and keep track of your job search related activities. JobSync app platform empowers you with the tools you need to stay organized, informed, and proactive throughout your job search.

### Dashboard

![App Snapshot](./screenshots/jobsync-dashboard-screenshot.png?raw=true "App Snapshot Image")

### Jobs Applied list

![App Snapshot](./screenshots/jobsync-myjobs.png?raw=true "My Jobs Page Snapshot Image")

### AI Resume review

![JobSync AI Demo](./screenshots/jobsync-ai.gif)

### AI Job match

![JobSync AI Demo](./screenshots/jobsync-ai-jobmatch.gif)

## Key Features
- **Application Tracker:** Keep a detailed record of all your job applications, including company details, job titles, application dates, and current status.

- **Monitoring Dashboard:** Visualize your job search progress with an interactive dashboard that provides insights into your application activities, success rates, and upcoming tasks.

- **Resume Management:** Store and manage your resumes, and use it with AI to get reviews and match with job descriptions.

- **Task & Activity Management:** Manage tasks, track activites linked with tasks included with time tracking. 

- **AI Assistant:** Leverage the power of AI to improve your resumes and match with jobs. Get personalized job matching with scoring to identify the best opportunities tailored to your profile.


## Free to Use and Self-Hosted
JobSync Assistant is completely free to use and open source. It provides a powerful job search management tool at no cost and ensures that everyone has access to the resources they need. Additionally, JobSeeker Assistant is designed to be self-hosted, giving you full control over your data. By using Docker, you can easily set up and run JobSync Assistant on your own server, ensuring a secure and personalized experience.


<!-- CAREERFLOW: appended "(Docker)" to the heading to distinguish it from the new
  "Local Development (no Docker)" subsection added by CareerFlow below; also updated
  the clone URL/directory to point at the CareerFlow repo. -->
## Quick Start (Docker)

Make sure [Docker](https://www.docker.com) is installed and running, then:

```sh
git clone https://github.com/nbjiragale/CareerFlow.git
cd CareerFlow
docker compose up
```

Open [http://localhost:3737](http://localhost:3737) and create your account. That's it!

<!-- CAREERFLOW: start new "Local Development (no Docker)" subsection (CareerFlow-added). -->
## Local Development (no Docker)

If you're contributing or hacking on the code, run the app directly with `npm run dev`. See [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) for the full guide.
<!-- CAREERFLOW: end CareerFlow-added subsection. -->

API keys for AI providers can be configured in **Settings** after signing in.

### Configuration (Optional)

Environment variables can be set in `docker-compose.yml`:

| Variable | Description |
|---|---|
| `TZ` | Your timezone (e.g. `America/Edmonton`). **Set this on remote servers** to avoid activity time shifts. |
| `AUTH_SECRET` | Auto-generated if not set. To set manually: `openssl rand -base64 32` |

### Updating

From the project directory, run the deploy script to pull the latest changes and rebuild:

```sh
curl -fsSL https://raw.githubusercontent.com/Gsync/jobsync/main/deploy.sh | sudo bash -s
```

>Note: If you are updating in a homelab environment, edit `NEXTAUTH_URL` in your `.env` file to use your server IP address instead of `localhost`. See `.env.example` for the expected format.

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started. This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md) — by participating, you agree to uphold its standards.

### Credits

- <a href="https://github.com/facebook/react">React</a>
- <a href="https://github.com/vercel/next.js">Next</a>
- <a href="https://github.com/shadcn-ui/ui">Shadcn</a>
- <a href="https://github.com/prisma/prisma">Prisma</a>
- <a href="https://github.com/tailwindlabs/tailwindcss">Tailwind</a>
- <a href="https://github.com/ueberdosis/tiptap">Tiptap</a>
- <a href="https://github.com/plouc/nivo">Nivo</a>
- <a href="https://github.com/sqlite/sqlite">Sqlite</a>
- <a href="https://github.com/vercel/ai">Vercel AI-SDK</a>
- <a href="https://github.com/ollama/ollama">Ollama</a>

### Supported AI Model Providers

API keys for all cloud providers can be configured in **Settings > AI Settings** after signing in. Ollama is selected as the default provider.

> **Note:** Selected models must support **structured output** for AI features to work correctly.

<details>
<summary><strong>Ollama (Local)</strong></summary>

Works with [Ollama](https://ollama.com) to run AI models locally on your machine.

- Make sure Ollama is installed and running on the same system
- AI settings will show a list of available models based on what you have downloaded in Ollama
- **Recommended:** Increase the Ollama context length from the default 4k for better results
- No API key required — runs entirely on your hardware

</details>

<details>
<summary><strong>OpenAI</strong></summary>

- Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Add your API key in **Settings > AI Settings**
- Select **OpenAI** as the provider and choose your preferred model
- Available models are fetched dynamically from the OpenAI API

</details>

<details>
<summary><strong>DeepSeek</strong></summary>

- Get your API key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
- Add your API key in **Settings > AI Settings**
- Select **DeepSeek** as the provider and choose your preferred model

</details>

<details>
<summary><strong>Google Gemini</strong></summary>

- Get your API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Add your API key in **Settings > AI Settings**
- Select **Gemini** as the provider and choose your preferred model

</details>

<details>
<summary><strong>OpenRouter</strong></summary>

Access a wide range of AI models from multiple providers through a single API.

- Get your API key at [openrouter.ai/keys](https://openrouter.ai/keys)
- Add your API key in **Settings > AI Settings**
- Select **OpenRouter** as the provider and choose from available models

</details>

### Note

- If you are updating from an old version and already logged in, please try logging out and login again.

