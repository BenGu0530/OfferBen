# OfferBen — Project Plan & Roadmap

> An AI job-application copilot inspired by *Offer Max*. One structured profile →
> a tailored resume, cover letter, recruiter email, and referral content for any job.
>
> Last updated: 2026-06-22

---

## 1. Vision

Build the full Offer Max feature set in phases, starting with the lowest-risk,
highest-value piece (AI resume generation) and growing toward a browser extension
and a semi-automatic "apply while you have breakfast" queue.

Guiding principles:

- **Solo-use now, product-ready later.** Code is modular and multi-tenant-safe so
  it can be open-sourced or commercialized without a rewrite.
- **Quality + safety over reckless automation.** Submission uses a human review
  gate to avoid account bans and wasted application slots.
- **Keep secrets server-side.** The Gemini key never reaches the browser/extension.

---

## 2. Status at a glance

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 0 | Monorepo foundation, core package, DB schema | ✅ Done |
| Phase 1 | MVP web app: build profile → score → generate → export PDF | ✅ Done |
| Phase 2 | Browser extension: JD capture + autofill | 🟡 Started (capture done, autofill pending) |
| Phase 3 | Semi-auto apply queue with review gate | ⬜ Planned |
| Phase 4 | Interview prep + research on HR / tech leads | ⬜ Parked |

Legend: ✅ done · 🟡 in progress · ⬜ planned/not started

---

## 3. Architecture

```
offerben/
  apps/
    web/            Next.js 14 app (4-step wizard + server API routes)
    extension/      MV3 browser extension (plain JS, no build) — Phase 2
  packages/
    core/           Shared logic: schemas, AI provider abstraction, prompts,
                    JD parsing, match scoring, tailoring, letters
    db/             Supabase client + schema.sql (Postgres + RLS) — optional
```

All business logic lives in `packages/core`; the web app and extension are thin
shells so logic is reused, not duplicated.

Tech: npm workspaces + Turborepo · Next.js 14 / React 18 / Tailwind · Zod ·
Google Gemini (default `gemini-2.5-flash`, swappable) · `@react-pdf/renderer` ·
Supabase (optional).

> Note: the original plan specified pnpm; this environment couldn't install pnpm
> without root, so the repo uses **npm workspaces**. Turborepo config is retained.

---

## 4. Done ✅

### Phase 0 — Foundation
- [x] npm workspaces + Turborepo monorepo (`apps/*`, `packages/*`).
- [x] Shared TypeScript base config, `.gitignore`, `.env.example`, README.
- [x] `packages/core`: profile/job/match/generation schemas (Zod, JSON-Resume based).
- [x] Swappable `AIProvider` abstraction + Gemini implementation + factory.
- [x] `packages/db`: Supabase public/service clients + `schema.sql` with Row Level
      Security on every table (multi-tenant safe from day one).
- [x] Secret management: `GEMINI_API_KEY` read server-side only; `.env.local`
      git-ignored.

### Phase 1 — MVP web app
- [x] Profile import: upload resume PDF / LinkedIn export / paste text → LLM
      extraction into a structured profile.
- [x] Job input: paste JD (title/company/URL/description).
- [x] Match analysis: JD parsing + 0–100 score + matched/missing keywords +
      strengths/gaps/suggestions, shown with a score ring.
- [x] Generation: tailored resume (truthful rewrite + reorder), cover letter,
      recruiter email, referral note, referral Q&A.
- [x] ATS-safe PDF export (single-column, standard fonts) via `@react-pdf/renderer`.
- [x] 4-step wizard UI (Profile → Job → Match → Generate) with local persistence.
- [x] Verified: production build passes, API routes return clean errors without a key.

### Cross-cutting (added after MVP)
- [x] Export/Import backup: download profile+job as JSON, restore on another
      machine (no cloud needed).
- [x] Extension → web handoff: web app reads a `?job=` URL param to pre-fill a
      captured job.
- [x] Provider-agnostic storage layer (`packages/core/src/storage`): `ProfileStore`
      interface + `GoogleDriveStore` (least-privilege `drive.file` scope).
- [x] Google Drive sync in the web app (opt-in): each user syncs their profile to
      **their own** Drive via Google Identity Services. Local stays the default;
      Drive buttons appear only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.
- [x] Application tracker: save scored jobs (score/verdict/status/date), edit
      status (saved→applied→interviewing→rejected→offer), syncs in AppData to Drive.
- [x] Generated docs → Drive files: "Save to Drive" in the Generate step writes a
      readable Markdown application doc to `My Drive/OfferBen/applications/`
      (app-created, so it round-trips under `drive.file`); the tracker links to it
      ("📄 Drive"). Chosen over inlining in one JSON so each application is a file
      the user can browse/open/share — lower-barrier + open-source friendly.
- [x] Editable profile: fix name/headline/email/phone/skills after AI extraction.

### Phase 2 — Extension (partial)
- [x] MV3 manifest + popup UI (capture, edit, send).
- [x] JD extraction adapters: Greenhouse, Lever, Ashby, Workday + generic fallback.
- [x] "Open in OfferBen" handoff (key stays server-side).
- [x] **Side Panel UI** (v0.2): docks next to the live job page, reads it, and
      scores it. Chrome/Edge 114+. Reuses the `extract.js` adapters; popup legacy.
      - **Scoring is manual by default** ("⚡ Score this job" button) — an
        "Auto-score as I browse" toggle (Settings) opts into per-page AI. Avoids
        spending quota / firing on every page (incl. non-job pages).
      - Extension→web handoff uses a short token via `/api/handoff` (POST→id,
        open `/?h=id`); the old base64-JD-in-URL overflowed headers (HTTP 431).

---

## 5. In progress / Next up 🟡

### Phase 2 — finish the extension
- [x] **Inline match score in the side panel** — reads the JD and scores it
      against the synced profile in-panel; caches per URL (revisits cost 0 calls).
- [x] **Profile in the panel via Google Drive** — panel reads the profile from the
      user's Drive (`offerben-data.json`) via chrome.identity; cached locally.
- [x] **Screenshot + vision fallback** — when DOM read fails, `captureVisibleTab`
      → `/api/capture` → vision model (`extractJobFromImage`). Gated to explicit
      open/⟳ so silent navigations don't burn quota. A robustness fallback, *not*
      a scraping shortcut (user-initiated, single-page).
- [~] **Autofill application forms** — v2: fills contact + website + current
      company/title + school/degree/field + city/state/country across inputs,
      textareas, and `<select>`s; deliberately SKIPS sensitive fields (work auth,
      sponsorship, EEO, salary) and reports how many it left for the human.
      Next: per-ATS field-mapping registry for tricky layouts (Workday, Ashby).
- [ ] Extract this into a `packages/ats-adapters` package shared by capture + autofill.
- [ ] Inline match score badge on the job page (no need to open the app).
- [ ] One-click read of the user's own LinkedIn profile (in their logged-in browser).
- [ ] Migrate extension to WXT + React + TypeScript so it can import
      `@offerben/core` directly (needs a bundler step) — also lets the extension
      reuse `GoogleDriveStore` for its own Drive sync.
- [ ] Extension icons + store-ready packaging.

---

## 6. Planned ⬜

### Phase 3 — Semi-auto apply queue ("breakfast mode")
- [ ] Job discovery / enqueue (search boards or batch-capture).
- [ ] Batch tailor resumes for all queued jobs.
- [ ] Autofill each application.
- [ ] **Review gate**: auto-fill everything, pause for a one-glance human approval,
      then submit in batch (protects against bans and wasted application slots).
- [ ] Human-paced submission, prioritizing LinkedIn Easy Apply; external ATS uses
      "fill + 1-click confirm".

### Phase 4 — Bonus
- [ ] Interview prep: predicted behavioral/technical questions + STAR draft answers.
- [x] **Research HR / tech leads** ("Research" view): name + institution → OpenAlex
      author lookup (disambiguated by institution) → schools/labs/affiliations,
      publications, and an LLM-inferred **research taste + outreach talking points**.
      Clean official API, no scraping. Data fetch needs no AI/quota; only the taste
      summary calls the model (degrades gracefully if unavailable).
      - Deliberately NOT done: LinkedIn likes/comments/post interactions — no
        compliant API; scraping violates ToS and risks bans. Taste is inferred
        from real publications instead.
      - Caveat: OpenAlex author disambiguation can be noisy (the `affiliations`
        list especially); publications are the most reliable signal.

### Persistence / accounts (when needed)
- [ ] Wire Supabase Auth + the existing RLS schema for cloud sync across devices.
- [ ] Real generation **history** (currently not persisted between sessions).

---

## 7. Known gaps / missing vs Offer Max

| Capability | Offer Max | OfferBen now | Plan |
|---|---|---|---|
| Upload resume / paste text | ✅ | ✅ | — |
| One-click read LinkedIn profile | ✅ (extension) | ❌ | Phase 2 |
| JD capture from career pages | ✅ | 🟡 (extension built, not yet load-tested by user) | Phase 2 |
| Match scoring | ✅ | ✅ | — |
| Tailored resume + letters | ✅ | ✅ | — |
| Autofill application forms | ✅ | ❌ | Phase 2 |
| Interview question prep | ✅ | ❌ | Phase 4 |
| Cloud sync / multi-device | ✅ (Supabase) | 🟡 (Google Drive sync in web app; needs OAuth client id) | Drive now · Supabase later |
| Saved application history | ✅ | ❌ | Phase 3 / persistence |

### Other current limitations
- Storage is browser `localStorage` only; clearing the browser loses data
  (mitigated by Export/Import).
- Vitest unit tests cover pure core logic (`packages/core/test/`): JSON
  extraction, retry/transient classification, object utils, schema tolerance,
  abstract reconstruction. Run with `npm test`. (UI / API routes not yet covered.)
- No authentication (single-user assumption).
- Extension is plain JS and does not yet share `@offerben/core` code.
- Free Gemini tier rate limits apply; fine for personal use, not for bulk.

---

## 8. How to run

```bash
npm install
cp .env.example apps/web/.env.local   # then set GEMINI_API_KEY
npm run dev                            # http://localhost:3000
```

Extension: `chrome://extensions` → Developer mode → Load unpacked → `apps/extension`.

---

## 9. Decision log

- **pnpm → npm workspaces**: sandbox couldn't install pnpm without root.
- **Storage: localStorage first**: zero-backend to validate AI quality; Supabase
  schema is ready for later.
- **LinkedIn import via file/paste (not scraping)**: compliant; one-time setup is
  outside the apply loop so it doesn't hurt efficiency. Extension "read your own
  profile" is a Phase 2 enhancement in the user's own browser.
- **Submission via review gate (not full auto)**: higher quality, avoids bans and
  wasted single-shot applications.
- **Key stays server-side**: extension hands off via URL; never holds the key.
- **Provider-agnostic AI, env-driven**: one `OpenAICompatibleProvider` covers
  OpenAI/Groq/OpenRouter/DeepSeek/Ollama/self-hosted fine-tunes; `AI_PROVIDER`
  selects the backend. Swapping models is config, not code — so we're not locked
  to Gemini (whose free tier is only 20 req/day/model).
- **Match = 1 AI call**: dropped the separate parseJob; keyword data is derived
  from the match result. Extension caches scores per URL (revisits cost 0 calls)
  to stretch the free tier.
- **Model fallback for reliability**: `GeminiProvider` tries a chain of models
  (primary → `gemini-2.0-flash-lite` → `gemini-2.5-flash` → `gemini-2.0-flash`).
  Free-tier models get deprioritized during demand spikes (503 UNAVAILABLE);
  each model is a separate capacity pool, so falling over makes calls succeed
  instead of dying after a few retries. Validated end-to-end (2026-06-24):
  match, tailor, letters, people dossier+taste, and vision capture all work.
- **Cloud sync = user's own Google Drive (not our server)**: chose "bring your own
  storage" so the published app never holds anyone's resume PII, needs no backend,
  and works for everyone for free. Uses the least-privilege `drive.file` scope
  (app sees only its own file) to stay out of Google's costly `restricted`-scope
  CASA security review. Local mode remains the default; Drive is opt-in.
