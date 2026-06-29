# OfferBen

An AI job-application copilot, inspired by *Offer Max*. Keep **one structured
profile**; for any job get a tailored resume, cover letter, recruiter email,
referral content, a match score, and an application tracker — plus "research a
person" to prep outreach and interviews. A Chrome **side-panel extension** docks
next to a live job page, auto-reads it, and scores it against your profile.

Your data stays yours: local in the browser by default, optionally synced to
**your own Google Drive**. No scraping, no auto-submit.

## Features

- **Profile** — upload a resume PDF / LinkedIn export (or paste text) → AI
  extracts a structured, editable profile you reuse for every application.
- **Match** — honest 0–100 score, matched/missing keywords, strengths, gaps,
  concrete suggestions.
- **Generate** — tailored resume (truthful rewrite + reorder), cover letter,
  recruiter email, referral note + Q&A; ATS-safe PDF export.
- **Side-panel extension** — docks beside the job page, auto-reads it (DOM
  adapters for Greenhouse/Lever/Ashby/Workday + a screenshot→vision fallback for
  messy pages), scores inline, and can autofill application forms (review-gated).
- **Applications tracker** — save scored jobs with status (saved → applied →
  interviewing → rejected → offer) and history.
- **Research a person** — a hiring manager / referrer's schools, labs,
  publications, and an inferred research taste + outreach talking points, via
  the OpenAlex API (no scraping).
- **Bring-your-own storage** — optional Google Drive sync (least-privilege
  `drive.file`); otherwise everything is local.
- **Bring-your-own model** — Gemini by default, or any OpenAI-compatible backend
  (OpenAI / Groq / OpenRouter / Ollama / your own) via one env var.

## Monorepo layout

```
apps/
  web/         Next.js 14 — wizard (Profile → Job → Match → Generate),
               Applications + Research views, and the server API routes.
  extension/   MV3 Chrome side-panel extension (plain JS, no build step).
packages/
  core/        Shared logic: schemas, AI provider abstraction, prompts, JD
               parse/vision, match scoring, tailoring, letters, people research,
               storage backends.
  db/          Supabase client + schema.sql (RLS). Optional / not wired yet.
```

All real logic lives in `packages/core`; the web app and extension are thin
shells over it. Tech: npm workspaces + Turborepo · Next.js 14 / React 18 /
Tailwind · Zod · `@react-pdf/renderer` · Google Gemini (swappable).

## Getting started

```bash
# 1. Install (from the repo root)
npm install

# 2. Configure your AI key
cp .env.example apps/web/.env.local
#    then set GEMINI_API_KEY (free key: https://aistudio.google.com/apikey)

# 3. Run the web app
npm run dev        # http://localhost:3000
```

**Extension:** `chrome://extensions` → Developer mode → **Load unpacked** →
select `apps/extension`. See [apps/extension/README.md](apps/extension/README.md)
for the side-panel + Google Drive setup (one-time OAuth redirect URI).

> **Heads-up on the free tier:** Gemini's free tier is ~20 requests/day per
> model. If calls start returning "model is busy / out of quota", you're rate-
> limited until midnight Pacific — switch `GEMINI_MODEL` (separate quota bucket)
> or point `AI_PROVIDER=openai` at another backend. See `.env.example`.

## Security & compliance

- The AI key is read only in server-side API routes; never sent to the browser
  or the extension.
- Google Drive sync uses the least-privilege `drive.file` scope — the app only
  ever sees the one `offerben-data.json` it creates.
- **No scraping / no automation overreach:** we read the page you're actively
  viewing (user-initiated, single page); we never bulk-crawl, and we never
  automate LinkedIn. Autofill fills + reports but never auto-submits, and skips
  sensitive fields (work authorization, EEO, salary).

## Contributing

Read **[CLAUDE.md](CLAUDE.md)** first — it's the shared context (architecture,
conventions, and the invariants not to break) for both humans and AI agents.
**[PROJECT_PLAN.md](PROJECT_PLAN.md)** is the living status + decision log; update
it as you go. Personal notes/keys go in `CLAUDE.local.md` (copy from
`CLAUDE.local.md.example`; it's git-ignored). Run `npm run typecheck` before you
commit. Open work is tracked in GitHub Issues (see `docs/ISSUES.md` for the
starter backlog).
