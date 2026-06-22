# OfferBen

An AI job-application copilot, inspired by *Offer Max*. This repo is the **Phase 1 MVP**: a
zero-risk, pure-generation web app that turns one structured profile into a tailored resume,
cover letter, recruiter email, and referral note for any job description.

> Roadmap (browser extension for JD capture + autofill, and the semi-auto "breakfast mode"
> apply queue with a review gate) is described in the plan. This MVP intentionally does **no**
> scraping or automation — it is safe to run today.

## Monorepo layout

```
offerben/
  apps/
    web/            # Next.js app (build profile -> score job -> generate -> export PDF)
  packages/
    core/           # shared business logic: schema, AI provider abstraction, prompts, generation
    db/             # Supabase client + schema.sql + RLS (optional cloud persistence)
```

All real logic lives in `packages/core` so the future browser extension can reuse it. The web
app and (later) the extension are thin shells over `core`.

## Tech stack

- npm workspaces + Turborepo (monorepo)
- Next.js (App Router) + React + Tailwind CSS
- Google Gemini (default `gemini-2.5-flash`), abstracted behind an `AIProvider` interface so it
  can be swapped for OpenAI/Anthropic/local
- Zod for schema validation
- `@react-pdf/renderer` for ATS-safe PDF export
- Supabase (Postgres + Auth + RLS) — optional, for cloud persistence / multi-user

> Note: the plan specified pnpm; this environment could not install pnpm without root, so the
> repo uses **npm workspaces** instead. Turborepo config is included.

## Getting started

```bash
# 1. Install dependencies (from the repo root)
npm install

# 2. Configure your Gemini key
cp .env.example apps/web/.env.local
#   then edit apps/web/.env.local and set GEMINI_API_KEY

# 3. Run the dev server
npm run dev
# open http://localhost:3000
```

## Security

- `GEMINI_API_KEY` is read only inside server-side API route handlers and is never sent to the
  browser.
- With no Supabase env vars, your profile is stored locally in the browser only.
- `packages/db/schema.sql` enables Row Level Security on every table, so the data model is
  multi-tenant safe from day one (enabling it requires wiring Supabase Auth).
