# Starter backlog — GitHub Issues

Curated from `PROJECT_PLAN.md` and current gaps. Each is one issue: copy the
title + body into GitHub. Labels suggested in brackets. `gh` one-liner at bottom.

Priority: **P1** = do soon · **P2** = next · **P3** = later. 🟢 = good first issue.

---

## P1 — foundation & correctness

### 1. Add a test harness + first tests [infra] 🟢
There are no automated tests. Set up Vitest at the root, wire `npm test` across
workspaces, and add first unit tests for the pure logic in `packages/core`
(`ai/json.ts` extractJson, `match` keyword synthesis, `storage` round-trip,
`people/research` abstract reconstruction).
**Done when:** `npm test` runs in CI-able form and core has >0 meaningful tests.

### 2. Validate vision + scoring end-to-end once quota is available [extension][ai]
The screenshot→vision fallback (`/api/capture`) and side-panel auto-scoring are
code-complete but were blocked by the Gemini daily free-tier cap during dev.
Run the full path on a real LinkedIn job page and a Greenhouse page; fix any
issues found.
**Done when:** a LinkedIn job that DOM-fails is read via vision and scored.

### 3. Surface model/quota state in the UI [web][ux] 🟢
When the model is rate-limited (429/“out of quota”), the UI shows a generic
busy message. Show which provider/model is active and a clear “daily free-tier
limit hit — resets midnight Pacific, or switch provider” hint.
**Done when:** a 429 renders an actionable message, not just “busy”.

---

## P2 — close the loop

### 4. Persist generated documents into the application tracker [web][core]
The tracker stores score/status but not the generated resume/letters. Save the
generated artifacts per application so a record is a full archive; show them
when revisiting. Include in `AppData` so they sync to Drive.
**Done when:** generating from a tracked job attaches the docs to that record.

### 5. Use “research a person” inside generation [web][ai]
Wire the Research dossier/taste into the referral note + cover letter prompts
(“write outreach referencing this person’s research taste”).
**Done when:** a referral note can be generated from a selected researcher.

### 6. Autofill: per-ATS field-mapping registry [extension]
The autofill v2 is generic heuristics. Add tuned selectors for Workday and
Ashby (the trickiest layouts), structured as a small per-host registry.
Keep the sensitive-field skip + review-gate. [Builds on existing `fillFormInPage`.]
**Done when:** a Workday and an Ashby form fill the contact block reliably.

### 7. Inline generation in the side panel [extension][web]
After scoring in the panel, let the user generate a cover letter / referral note
in-panel (calls the web API) without opening the full app.
**Done when:** cover letter is generatable from the side panel.

### 8. Format/lint hook in shared `.claude/settings.json` [infra][dx] 🟢
Add a Claude Code hook that runs Prettier/ESLint on edited files so both
contributors’ code stays consistent (deterministic, not prompt-dependent).
Commit `.claude/settings.json`; keep `settings.local.json` personal.
**Done when:** editing a file via Claude Code auto-formats it.

---

## P3 — reach & polish

### 9. Migrate extension to WXT + TypeScript [extension][refactor]
Move the plain-JS extension to WXT + TS so it imports `@offerben/core` directly
(reuse `GoogleDriveStore`, schemas, adapters) instead of duplicating logic.
**Done when:** the extension builds with a bundler and imports core.

### 10. Publish-readiness: optional host permissions + icons + store packaging [extension]
Replace `host_permissions: ["https://*/*"]` with `optional_host_permissions`
requested per-site at runtime (less scary install prompt, easier review). Add
icons and a store listing.
**Done when:** install prompt no longer says “all websites”; icons present.

### 11. Import an existing resume PDF from Google Drive (Google Picker) [web]
Let users pick a resume already in their Drive via the Google Picker (grants
per-file access under `drive.file`), instead of only disk upload.
**Done when:** a Drive-resident PDF can be selected and extracted.

### 12. People research: add Semantic Scholar / arXiv + better disambiguation [core]
OpenAlex author disambiguation is noisy (affiliations especially). Add a second
source and improve candidate ranking; flag low-confidence matches.
**Done when:** a known researcher resolves to correct affiliations.

### 13. Hosted API for the published extension [infra][backend]
For a shipped extension, users can’t run `localhost:3000`. Stand up a hosted
API endpoint (keeps the key server-side) the extension can point at.
**Done when:** extension works against a deployed URL with no local server.

### 14. Supabase auth + cloud sync [backend]
Wire the existing `packages/db` RLS schema + Supabase Auth for multi-device sync
as an alternative to Drive. [Only when needed.]

### 15. Interview prep (Phase 4) [ai]
Predicted behavioral/technical questions + STAR draft answers from profile + JD.

---

### Create them all with gh (after `gh auth login`)

```bash
# example for one issue:
gh issue create --title "Add a test harness + first tests" \
  --label infra,"good first issue" \
  --body "There are no automated tests. Set up Vitest at the root ..."
```
