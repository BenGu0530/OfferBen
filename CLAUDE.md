# CLAUDE.md — shared context for AI agents (and humans)

> This is the **stable** layer: architecture, conventions, invariants. It's read
> into context every session, so keep it tight. The **living** layer (what's done,
> what's next, why) is [PROJECT_PLAN.md](PROJECT_PLAN.md) — update that after each
> chunk of work and commit it, so the other contributor's agent stays in sync.
> Personal notes / keys go in `CLAUDE.local.md` (git-ignored), never here.

## What this is

OfferBen — an AI job-application copilot. One structured profile → a 
tailored resume, cover letter, recruiter email, referral content, a
match score, an application tracker, and "research a person" (a hiring manager /
referrer's schools, labs, papers, research taste). A Chrome **side-panel
extension** docks next to a live job page, auto-reads it, and scores it.

Two-person open-source project. Goal: make job-hunting less painful.

## Monorepo layout

```
apps/
  web/         Next.js 14 (App Router) — 4-step wizard + Applications + Research
               views, and the server API routes that hold the AI key.
  extension/   MV3 Chrome side-panel extension (plain JS, no build step).
packages/
  core/        ALL business logic: schemas (Zod), AI provider abstraction,
               prompts, JD parse, match scoring, tailoring, letters, vision
               capture, people research, storage backends.
  db/          Supabase client + schema.sql (RLS). Optional / not wired yet.
```

**Golden rule:** real logic lives in `packages/core`; `apps/*` are thin shells.
If you're writing a prompt or business rule in a component or route handler,
it probably belongs in core.

## Commands (run from repo root)

```bash
npm install          # install all workspaces
npm run dev          # web app at http://localhost:3000
npm run build        # production build of the web app
npm run typecheck    # tsc --noEmit across all workspaces — run before committing
npm test             # Vitest (unit tests for pure core logic) — run before committing
npm run lint         # next lint (web)
```
Node 20+ (developed on Node via Homebrew). Extension: load `apps/extension`
unpacked at `chrome://extensions` (Developer mode). See `apps/extension/README.md`.

## Critical invariants — don't break these

1. **Secrets stay server-side.** The AI key (`GEMINI_API_KEY` / `AI_API_KEY`) is
   read ONLY in `apps/web/app/api/**` route handlers via `createAIProvider()`.
   Never expose it to the client or the extension. The extension calls the web
   API; it never holds a key.
2. **Client imports types-only from core.** `apps/web/lib/types.ts` re-exports
   core types with `export type`. Importing a core *runtime value* into a client
   component pulls the Gemini SDK into the browser bundle. If you need a runtime
   constant client-side, define a local copy (see `APPLICATION_STATUSES`).
3. **AI is provider-agnostic.** Everything depends on the `AIProvider` interface
   (`packages/core/src/ai/provider.ts`). Pick the backend with env vars
   (`AI_PROVIDER`), never hardcode a model in business logic. Gemini is the
   default; `OpenAICompatibleProvider` covers OpenAI/Groq/OpenRouter/Ollama/etc.
4. **No scraping.** We read the page the user is actively viewing, user-initiated,
   single-page — via the extension's content script (DOM) or a screenshot+vision
   fallback. No server-side fetching of job sites, no bulk crawling, no LinkedIn
   automation (likes/comments/connections). This is a hard product + legal line.
5. **Least-privilege Drive.** Google Drive sync uses the `drive.file` scope only
   (the app sees just the one `offerben-data.json` it creates). Don't widen it.
6. **Submission has a human review gate.** Autofill fills + reports; it never
   auto-submits, and it deliberately skips sensitive fields (work auth, EEO,
   salary). Keep the human in the loop.

## Where things live (core)

- `ai/` — `provider.ts` (interface), `gemini.ts`, `openai.ts`, `retry.ts`
  (shared backoff; retries transient 429/503 + bad-JSON), `json.ts`, `index.ts`
  (`createAIProvider` factory, env-driven).
- `schema/` — Zod schemas: profile (JSON-Resume based), job, match, generation.
- `profile/extract.ts`, `jd/parse.ts`, `jd/vision.ts`, `match/score.ts`,
  `tailor/resume.ts`, `tailor/letters.ts`, `people/research.ts` (OpenAlex).
- `storage/` — `ProfileStore` interface + `GoogleDriveStore`, `AppData` shape
  (profile + job + applications), shared by web + extension.

## Web API routes (`apps/web/app/api`)

`profile/extract`, `match` (1 AI call — derives keywords from the result),
`tailor`, `letters`, `capture` (screenshot→vision), `people/search` (OpenAlex,
no AI), `people/dossier` (OpenAlex + AI taste). All wrapped by `lib/server.ts`
`jsonHandler` (uniform JSON errors).

## Gotchas

- **Free-tier quota is tiny.** This project's Gemini free tier is ~20 requests/
  **day per model** (resets midnight Pacific). The extension caches match results
  per-URL and `match` is a single call to conserve it. If everything 429s, you're
  rate-limited — switch `GEMINI_MODEL` to another model (separate bucket) or set
  `AI_PROVIDER=openai` with a different backend. See `.env.example`.
- **Vision fallback costs a call**, so it's gated to explicit open/⟳, not silent
  navigations.
- Run `npm run typecheck` AND `npm test` before committing. Tests cover pure core
  logic (`packages/core/test/`); add a test when you add a pure function.

## Conventions

- TypeScript everywhere in web/core; the extension is intentionally plain JS
  (no bundler) — keep injected scripts self-contained.
- Match the surrounding code's style; comments explain *why*, not *what*.
- Shared agent config lives in `.claude/` (committed): `settings.json` wires two
  hooks — auto-Prettier on edited files (`hooks/format.sh`) and a Bash guard that
  blocks force-push / `rm -rf` on dangerous paths (`hooks/guard-bash.sh`). Keep
  `settings.local.json` and `CLAUDE.local.md` personal (git-ignored).
- Work is tracked in GitHub Issues (labels P1/P2/P3 + area); `docs/ISSUES.md` is
  the seed list.
