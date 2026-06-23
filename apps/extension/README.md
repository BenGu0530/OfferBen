# OfferBen — Job Copilot (browser extension)

Phase 2. A Manifest V3 **side-panel** extension that docks next to the job page
you're viewing, auto-reads it, and hands it off to the OfferBen web app for AI
tailoring. The panel stays open beside the live site — no copy-paste, no window
arranging.

This is **plain JS — no build step**. Load it directly.

## What it does

1. Click the OfferBen toolbar icon → the side panel docks on the right.
2. Open a job posting (Greenhouse, Lever, Ashby, Workday, or any page). The panel
   **automatically reads** the title / company / description as you browse
   (site-specific adapters with a generic fallback). Hit ⟳ to re-read.
3. Click **Tailor in OfferBen** — opens the web app with the job pre-filled, so
   you go straight to the match + generate steps.

The extension never holds the Gemini key. The job is passed via URL to the web
app, where the key stays server-side.

```
career page ──auto-read──▶ OfferBen side panel ──?job=base64──▶ web app (AI)
        (you keep browsing on the left)        (tool docked on the right)
```

## Load it (Chrome / Edge)

1. Make sure the web app is running: `npm run dev` (defaults to http://localhost:3000).
2. Go to `chrome://extensions`.
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder: `apps/extension`.
5. Pin the extension and click it — the side panel opens. Browse to any job page.

> Side Panel requires Chrome/Edge 114+. If your web app runs on a different URL,
> set it in the panel footer field (stored per-browser).

> Safari does not support the Side Panel API — a Safari build would need a
> different surface (popover/window) and is out of scope for this Chrome-first v1.

## Files

- `manifest.json` — MV3 manifest (`sidePanel`, `activeTab`, `scripting`, `storage`, `tabs`).
- `background.js` — opens the side panel when the toolbar icon is clicked.
- `extract.js` — injected into the page to read the job (site adapters + fallback).
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js` — the docked panel UI + auto-read.
- `popup.*` — legacy popup (superseded by the side panel; kept for reference).

## Roadmap (next)

- **Inline match score** in the panel (call the web API with the synced profile).
- **Profile in the panel**: read the profile from the user's Google Drive
  (`@offerben/core` `GoogleDriveStore`) so scoring + generation happen in-panel.
- **Screenshot + vision fallback**: when DOM read fails, `captureVisibleTab` →
  Gemini vision to read the rendered page (robustness, not a scraping shortcut).
- Autofill application forms (the `ats-adapters` registry from the plan).
- Migrate to WXT + React + TypeScript and import `@offerben/core` directly.
