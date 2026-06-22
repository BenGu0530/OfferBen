# OfferBen — Job Capture (browser extension)

Phase 2 scaffold. A Manifest V3 extension that captures a job description from any
career page and hands it off to the OfferBen web app for AI resume tailoring.

This is **plain JS — no build step**. Load it directly.

## What it does

1. You open a job posting (Greenhouse, Lever, Ashby, Workday, or any page).
2. Click the OfferBen toolbar icon.
3. It extracts the title / company / description (site-specific adapters with a
   generic fallback), and lets you tweak them.
4. Click **Open in OfferBen** — it opens the web app with the job pre-filled, so
   you go straight to the match + generate steps.

The extension never holds the Gemini key. The job is passed via URL to the web
app, where the key stays server-side.

```
career page ──capture──▶ extension popup ──?job=base64──▶ OfferBen web app (AI)
```

## Load it (Chrome / Edge)

1. Make sure the web app is running: `npm run dev` (defaults to http://localhost:3000).
2. Go to `chrome://extensions`.
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder: `apps/extension`.
5. Pin the extension, open a job posting, and click it.

> If your web app runs on a different URL, set it in the popup footer field
> (stored per-browser).

## Files

- `manifest.json` — MV3 manifest (minimal permissions: `activeTab`, `scripting`, `storage`).
- `extract.js` — injected into the page to read the job (site adapters + fallback).
- `popup.html` / `popup.css` / `popup.js` — the capture UI and handoff logic.

## Roadmap (later)

- Autofill application forms (the `ats-adapters` registry from the plan).
- Inline match score on the page.
- One-click read of your own LinkedIn profile.
- Migrate to WXT + React + TypeScript and import `@offerben/core` directly once a
  bundler is in place.
