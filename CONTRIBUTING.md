# Contributing to OfferBen

Welcome! This is a small two-person open-source project. Read
**[CLAUDE.md](CLAUDE.md)** first — it's the shared context and the invariants not
to break. Status lives in [PROJECT_PLAN.md](PROJECT_PLAN.md)（中文）. Open work is in
[GitHub Issues](../../issues).

## Prerequisites

- Node 20+ and npm.
- (Optional) Chrome/Edge 114+ to run the side-panel extension.

## Quick start (the minimum — no Google account needed)

```bash
git clone https://github.com/BenGu0530/OfferBen
cd OfferBen
npm install

# Get your OWN free AI key (each contributor uses their own):
#   https://aistudio.google.com/apikey
cp .env.example apps/web/.env.local
#   then set GEMINI_API_KEY=... in apps/web/.env.local  (git-ignored; never commit it)

npm run dev          # http://localhost:3000
```

That's it — **everything works with just your own AI key**: profile, match,
generate, tracker, research, and the extension's job scoring. Use your **own**
key (the free tier is ~20 requests/day *per Google account*, so separate keys =
more total quota, and nobody shares secrets).

**Extension:** `chrome://extensions` → enable Developer mode → **Load unpacked**
→ select `apps/extension`. It calls your local `npm run dev` server.

## Optional: Google Drive sync

Only needed if you want to test the "sync my profile to my own Drive" feature.
Local mode (no Google) is the default. To enable it, the **project owner** does a
one-time setup per contributor:

1. **Owner adds your Google account as a Test user** on the OAuth consent screen
   (the project is in "Testing" mode, so only test users can sign in).
2. **Owner shares the public OAuth Client ID** (it's not a secret). Put it in your
   `apps/web/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`.
3. **Extension only:** your unpacked extension gets its own extension ID, so its
   redirect URI must be registered. Either the owner adds
   `https://<your-extension-id>.chromiumapp.org/` to the OAuth client's
   *Authorized redirect URIs*, **or** we pin a stable extension ID via a manifest
   `key` so one redirect URI works for everyone (preferred — ask the owner).

If Drive sign-in fails with `redirect_uri_mismatch`, it's step 3. If it says the
app isn't verified, that's expected in Testing mode → Advanced → continue.

## Workflow

1. `git pull`, read **CLAUDE.md** + skim **PROJECT_PLAN.md**.
2. Pick a [GitHub Issue](../../issues) (look for the `good first issue` label).
3. Make the change. **Logic goes in `packages/core`; `apps/*` are thin shells.**
4. `npm run typecheck` and `npm test` (both must pass). Add a unit test in
   `packages/core/test/` when you add a pure function.
5. When done, ask your agent to **update PROJECT_PLAN.md** (what changed + why),
   then commit. This is how the other contributor's agent stays in sync — no
   information gap, no need to read raw chat history.
6. Commit to a branch and open a PR (don't force-push `main` — a hook blocks it).

## Working with Claude Code

The repo ships shared agent config in `.claude/` (committed):

- **Auto-format hook** — Prettier runs on every file you edit. Don't fight it.
- **Bash guard hook** — blocks `git push --force` and `rm -rf` on dangerous paths.

On first use of Claude Code in this repo you'll get a **"trust this folder's
`.claude` config?"** prompt — accept it to enable the hooks. Keep personal
settings in `.claude/settings.local.json` and personal notes in `CLAUDE.local.md`
(both git-ignored; copy `CLAUDE.local.md.example` to start).

## Conventions

- TypeScript in `web`/`core`; the extension is intentionally plain JS (keep
  injected scripts self-contained).
- Match the surrounding style; comments explain *why*, not *what*.
- **Don't break the invariants in CLAUDE.md:** secrets stay server-side; client
  imports types-only from core; AI stays provider-agnostic; no scraping;
  least-privilege Drive; submission keeps a human review gate.

## Reviewing PRs that touch `.claude/`

Treat changes to `.claude/` (hooks, settings, future skills/agents) like code:
review them. A checked-in hook/skill can run commands once the folder is trusted.
