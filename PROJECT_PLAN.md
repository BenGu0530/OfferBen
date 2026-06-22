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

### Phase 2 — Extension (partial)
- [x] MV3 manifest + popup UI (capture, edit, send).
- [x] JD extraction adapters: Greenhouse, Lever, Ashby, Workday + generic fallback.
- [x] "Open in OfferBen" handoff (key stays server-side).

---

## 5. In progress / Next up 🟡

### Phase 2 — finish the extension
- [ ] **Autofill application forms** — the big one. Field-mapping registry per ATS
      (name, email, phone, LinkedIn, work authorization / EEO answers).
- [ ] Extract this into a `packages/ats-adapters` package shared by capture + autofill.
- [ ] Inline match score badge on the job page (no need to open the app).
- [ ] One-click read of the user's own LinkedIn profile (in their logged-in browser).
- [ ] Migrate extension to WXT + React + TypeScript so it can import
      `@offerben/core` directly (needs a bundler step).
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

### Phase 4 — Bonus (parked)
- [ ] Interview prep: predicted behavioral/technical questions + STAR draft answers.
- [ ] Research HR / tech leads: papers and research taste via clean official APIs
      (OpenAlex, Semantic Scholar, arXiv, OpenReview, ORCID) — no scraping.

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
| Cloud sync / multi-device | ✅ (Supabase) | ❌ (local only) | when needed |
| Saved application history | ✅ | ❌ | Phase 3 / persistence |

### Other current limitations
- Storage is browser `localStorage` only; clearing the browser loses data
  (mitigated by Export/Import).
- No automated tests yet.
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
