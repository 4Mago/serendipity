# Marcus & Clara — Household PWA

> **Changed since approval:** Netlify Identity was removed at the user's
> request after the login could not be set up. The app now has no
> authentication at all — see the security note in `README.md`. Everything
> else below still holds.

## Context

Marcus and Clara want one shared app to run their couple life: food shopping list, colourful
expenditure graphics, recipes, apartment wishlist, shared errands, a schedule (gym, events,
travel) and — the centrepiece — a meal schedule.

Both install it on their phones, so this is genuinely multi-device shared state. It must also
work in a supermarket with bad signal, so the shopping list has to survive offline and
reconcile later.

**Hosting and storage are fixed: Netlify, using Netlify Blobs. No database.** This document
covers backend and stack only — the visual design is pending reference images.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite + React + TypeScript** | Static output, ideal for Netlify, fastest dev loop |
| PWA | **`vite-plugin-pwa`** (Workbox) | Generates manifest + service worker, handles precaching and update prompts |
| API | **Netlify Functions** | Blobs is only reachable from Netlify compute — see below |
| Storage | **Netlify Blobs** | Per the hosting decision |
| Auth | **Netlify Identity**, invite-only | Supported again as of Feb 2026, free on all plans, no second vendor |
| Server state | **TanStack Query** + IndexedDB persister | Offline read cache and a mutation queue that replays on reconnect |
| Charts | **Recharts** | The "colourful graphic for expenditures" |
| Drag & drop | **`@dnd-kit`** | Dragging recipes onto meal slots; proper touch support |

**Why Vite + React over the alternatives:** Next.js buys nothing here — the app is entirely
behind a login, so server rendering is wasted, and its App Router makes service-worker control
awkward. React Native means app-store accounts, and you asked for a PWA. SvelteKit is a
genuinely good alternative with smaller bundles; React wins only on ecosystem depth for the
specific pieces above (charts, touch DnD, offline query cache).

---

## What Blobs means in practice

Three properties of Netlify Blobs shape the entire design. None is a blocker at two-user scale,
but each needs designing around rather than discovering later.

**1. It is not reachable from the browser.** Blobs is accessed from Netlify compute only. So
every read and write goes through a Netlify Function; there is no direct-from-client SDK path
like Supabase or Firebase. This is fine, but it means an API layer is part of the build, not
optional.

**2. Last write wins, with no concurrency control.** If two overlapping writes hit the same
object, one silently overwrites the other. **This is the single most important design
constraint.** Storing "the shopping list" as one JSON object would mean that when Marcus adds
bread while Clara ticks off milk, whoever writes second erases the other's change — in exactly
the situation the app exists for.

The fix is to shard: **one blob per entity, never one blob per collection.** Marcus's write
touches `shopping/abc`, Clara's touches `shopping/def`, and they cannot collide. Two people
editing the *same item* at the same moment still resolves last-write-wins, but that is rare and
the most likely case — both ticking the same thing — is idempotent anyway.

**3. Default consistency is eventual**, propagating within ~60 seconds. That is unusable for a
shopping list two people are looking at simultaneously, so anything shared and live is read and
written with `consistency: 'strong'`. Slower reads, correct data. Recipes and the apartment
wishlist can stay eventual.

There is also no realtime/subscription mechanism, so both phones stay in sync by polling —
designed to be cheap below.

> Worth confirming against Netlify's docs during setup: current numeric quotas for object size,
> object count and request rates weren't verifiable and vary by plan. Two people's text data
> will be nowhere near any of them; recipe photos are the only thing that grows.

---

## Key layout

One store per domain, keys sharded per entity. Time-series collections are additionally
prefixed by month so a typical query lists one narrow prefix rather than all history.

```
profiles      /<userId>                    display name, colour
shopping      /<itemId>                    name, qty, unit, category, checked, addedBy, source
recipes       /<recipeId>                  title, servings, times, steps[], ingredients[], tags[]
meals         /<YYYY-MM>/<entryId>         date, slot, recipeId?, customTitle?, servings, cooked
expenses      /<YYYY-MM>/<expenseId>       amountMinor, category, description, spentAt, addedBy
categories    /<categoryId>                name, colour, icon, monthlyBudgetMinor
apartment     /<itemId>                    name, url, cost, room, status, votes{}
errands       /<errandId>                  title, assignedTo?, dueDate, done, doneBy, recurrence
events        /<YYYY-MM>/<eventId>         title, type, start, end, allDay, location, attendees[]
cursors       /<collection>                last-modified timestamp — see polling
```

Two deliberate choices:

- **Recipe ingredients are nested inside the recipe blob**, not sharded. A recipe is written as
  a unit by one person, so there is no collision risk, and it saves N reads per recipe. Ingredients
  are still *structured* (`{name, quantity, unit, category}`), which is what makes one-tap
  "add this week's meals to the shopping list" possible.
- **Money is stored as integer minor units** — öre, never a float. Currency is **SEK**,
  formatted with `Intl.NumberFormat('sv-SE')` so it renders as `249,50 kr`: comma decimal,
  non-breaking-space thousands separator, symbol trailing. Expenses are a **single shared
  pot** — no per-person split and no settle-up ledger. `addedBy` is kept only so the UI can
  show who logged an entry; it carries no financial meaning.

Reading a collection is one `list({ prefix })` plus parallel `get()`s inside the function,
returned to the client as a single JSON response. At two-person volumes this is comfortably
fast; month-sharding is what keeps it that way as expenses accumulate.

---

## Polling without waste

Every mutation writes a timestamp to `cursors/<collection>`. The client polls a single tiny
endpoint, `GET /api/changes`, which returns all cursors in one small response, and refetches
only the collections whose timestamp actually moved.

Polling runs roughly every 10s while the app is foregrounded, backing off when hidden, and is
tightened on the shopping screen where live sync matters most. A cursor is a bare timestamp, so
last-write-wins on it is harmless — the worst case is a redundant refetch.

---

## Function API

```
GET    /api/changes                    all collection cursors
GET    /api/:collection                list (optional ?month=YYYY-MM)
POST   /api/:collection                create
PUT    /api/:collection/:id            update
DELETE /api/:collection/:id            delete
POST   /api/shopping/from-meals        generate shopping list from a date range
POST   /api/uploads                    image upload
GET    /api/uploads/:id                image read, long cache headers
```

Every function validates the Netlify Identity JWT and rejects unauthenticated calls. With
Identity set to **invite-only**, only Marcus and Clara can ever hold an account, which is what
scopes the data — no row-level security needed, because there is nobody else.

Images pass through a function on both write and read, so they get aggressive cache headers to
keep repeat views off the function budget.

---

## What connects it all

This is what stops the app being seven unrelated lists:

1. **Plan meals → shopping list.** Take every planned entry in a date range, pull its recipe's
   ingredients, scale by `servings`, merge duplicates by `(name, unit)`, write each as its own
   `shopping/` blob tagged with the meal it came from — so an item can say "for Thursday's curry".
2. **Shopping trip → expense.** Completing a list offers to log its total as an expense, which
   lands straight in the charts.
3. **Travel → meal plan.** Events of type `travel` grey out the meal slots they cover, so the
   planner doesn't ask about dinners you won't be home for.
4. **Cooked → history.** Marking a meal cooked feeds "what did we actually eat this month" and
   surfaces neglected favourites.

Nullable `recipeId` plus `customTitle` matters more than it looks: plenty of dinners are
"leftovers", "takeaway" or "at Clara's parents", and forcing those through a recipe record
would make the planner tedious enough to abandon.

---

## Offline

`vite-plugin-pwa` precaches the app shell. TanStack Query persists its cache to IndexedDB for
reads, and mutations queue while offline and replay on reconnect. Because writes are
per-entity, a replayed queue merges cleanly instead of clobbering a whole list.

**iOS has no Background Sync API**, so the queue flushes when the app is next opened rather
than in the background. For a two-person shopping list that is a non-issue.

**Install:** HTTPS is automatic on Netlify. On iOS the app is added to the Home Screen from
Safari; since iOS 26, home-screen sites open as web apps by default. Web push works for
installed home-screen PWAs (iOS 16.4+) if we later want "Clara added something to the list" —
deferred, as it needs VAPID keys and a push handler in the service worker.

---

## Scope of the first pass

Food is the centre, so it gets the depth. **Meal planner, recipes, shopping list and expenses**
are built richly and wired to each other. **Errands, schedule and apartment wishlist** ship as
clean, working, deliberately simple lists — real and usable, just without the connective logic —
and get deepened later once the app is in daily use.

## Build order

**Phase A — no visual design needed, can start immediately.** None of this depends on the
aesthetic; it is plumbing, and it is most of the risk.

1. Scaffold Vite + React + TS + `vite-plugin-pwa`; manifest, icons; verify install on both phones
2. Netlify site, Identity invite-only, two accounts; auth guard and route protection
3. Blobs helpers, the generic CRUD function layer, and cursors
4. Client data layer: typed API client, TanStack Query, offline persistence, polling
5. Domain logic with tests: ingredient scaling and `(name, unit)` merging for meal→shopping;
   SEK formatting; month bucketing for expenses

**Phase B — begins once reference images arrive.**

6. Design tokens from the images, app shell and navigation
7. **Meal planner** — the main screen, and meal→shopping generation
8. Recipes
9. Shopping list: aisle grouping, offline ticking
10. Expenses + charts
11. Errands, schedule/events, apartment wishlist (the simpler three)
12. Polish: empty states, skeletons, iOS safe areas, update prompt

---

## Verification

- `netlify dev` — runs functions and a local Blobs sandbox alongside Vite
- Deploy; install on both phones from the HTTPS URL
- **Two-device test:** tick an item on one phone, confirm it appears on the other within a poll
  interval
- **Collision test:** two devices write different items simultaneously — both must survive.
  This is the specific failure the per-entity key design exists to prevent, so it gets tested
  explicitly rather than assumed
- **Offline test:** airplane mode, tick several items, add one, reconnect, confirm all replay
  with nothing lost or duplicated
- **Auth test:** an unauthenticated request to every `/api/*` route returns 401
- Lighthouse PWA audit passes installability

---

## Decisions taken

- **Hosting/storage:** Netlify + Netlify Blobs, no database
- **Currency:** SEK, stored in öre, formatted `sv-SE`
- **Expenses:** one shared pot — no split, no settle-up
- **Scope:** deep on meals/recipes/shopping/expenses; simple lists for errands/schedule/apartment

## Still open

**Visual design.** Reference images requested — vibe, colour/mood, meal-planner layout, chart
style. Phase A does not depend on them, so implementation can begin before they arrive.
