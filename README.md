# Hemma

Shared household app for Marcus & Clara — meal plan, shopping, recipes, budget,
errands, schedule and apartment wishlist. Installs to both phones as a PWA.

**Status: Phase A complete.** The backend, data layer and domain logic are
built and tested. The screens are placeholders until the visual design lands
(Phase B) — see `PLAN.md`.

## Stack

Vite + React + TypeScript · `vite-plugin-pwa` · Netlify Functions ·
Netlify Blobs · TanStack Query

There is no database. Storage is Netlify Blobs, one blob per entity, reached
through a Functions API — see "Design notes" below for why that shape.

## Setup

1. **Create the Netlify site** and link this directory:
   ```
   npx netlify login
   npx netlify init
   ```

2. **Run locally.** `netlify dev` serves Vite and the functions together on
   port 8888 — use that, not `vite` alone, or `/api/*` will 404.
   ```
   npm install
   npm run dev
   ```

3. **Deploy.** `npm run build && npx netlify deploy --prod` — but read the
   security note below first.

4. **Install on both phones** from the deployed HTTPS URL. On iOS this must be
   done from Safari via Share → Add to Home Screen.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | `netlify dev` — app + functions together |
| `npm run dev:vite` | Vite alone (no API) |
| `npm run build` | Typecheck both projects, then build |
| `npm run typecheck` | App and functions |
| `npm test` | Domain logic tests |
| `npm run icons` | Regenerate placeholder PWA icons |

## ⚠️ There is no authentication

The app has no login. Every `/api/*` route is open to anyone who can reach it,
and the `x-hemma-person` header that records who added something is
client-supplied and unverified — a display hint, not a credential.

Locally this is fine. **On a public deploy it means anyone with the URL can
read and change everything**: the shopping list, the budget, the calendar.

The smallest fix is a shared passphrase checked against an environment
variable. Every route already funnels through `readAuthor()` in
`netlify/lib/auth.ts`, so the gate goes in one function and nothing else has
to change.

## Layout

```
src/domain/     Pure logic and types. Shared by client and functions; no
                browser or Node APIs. This is where the tests live.
src/lib/        Client data layer — API client, query cache, hooks.
src/routes/     Screens. Currently placeholders plus a diagnostics harness.
netlify/lib/    Blobs store, request author, HTTP helpers.
netlify/functions/api.ts   Single entry point for all /api/* routes.
```

## Design notes

**One blob per entity, never one per collection.** Netlify Blobs has no
concurrency control — overlapping writes to the same object silently
last-write-win. A single "shopping list" object would mean that Marcus adding
bread while Clara ticks off milk loses one of the two changes, in exactly the
situation the app exists for. Sharding per entity makes that collision
impossible between different items.

**Strong consistency where it's shared and live.** Blobs defaults to eventual
consistency (~60s propagation), which is unusable for two people looking at the
same list. Live collections opt into `strong`; recipes and the wishlist don't
need to.

**Month-sharded keys** (`expenses/2026-09/<id>`) keep a typical read to one
narrow prefix as history accumulates, since there's no query engine to filter
server-side.

**Polling, not realtime.** Every mutation stamps `cursors/<collection>`. The
client polls one small endpoint and refetches only what actually moved, backing
off when the app is hidden.

**Offline.** The service worker precaches the shell; TanStack Query persists to
IndexedDB and queues mutations, replaying them on reconnect. iOS has no
Background Sync, so the queue flushes when the app is next opened — fine for a
shopping list.

**Money is integer öre.** Never a float. Swedish formatting throughout, where
the comma is a decimal separator and thousands are grouped with spaces.

## Known follow-ups

- **Add a gate before deploying publicly** — see the security note above.
- Placeholder icons in `public/icons/` are still placeholders.
- Shopping, recipes, expenses and the simpler three screens are not built yet.
