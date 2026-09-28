# Deal Intel SA — Handoff

**Updated:** 2026-09-28
**Owner:** ndominguez-cell · **Repo:** `ndominguez-cell/deal-intel-sa` · **Branch deployed:** `main`

Deal Intel SA finds good used-vehicle deals in the San Antonio market. Once a day it
pulls licensed dealer inventory from **MarketCheck** and **Auto.dev**, stores it in
Cloudflare D1, scores each listing against local comparables, and shows the best
deals on a dashboard.

## Current state (checked live 2026-09-28)

- **Live on Cloudflare Workers** (Worker `deal-intel-sa`). Pushes to `main` deploy
  automatically through Cloudflare Workers Builds.
- **Syncs are running.** The 8 most recent runs all finished `ok` (17 runs total). Last run: 2026-09-28
  12:00 UTC, 1,082 listings fetched, 709 written.
- **Database:** 1,165 listings, all scored. 0 leads captured so far.
- **Vehicle list in production:** all 10 targets are present in the database.
  Ram 1500 had 0 listings until the model-name fix; the 13:59 UTC sync brought in 100.
- **⚠️ Auto.dev is failing on every sync** since the switch to 10 vehicles. Only
  MarketCheck data is coming in. See **Open items #1**.

| Vehicle | Listings | Active | Avg price |
|---|---|---|---|
| Chevrolet Silverado 1500 | 344 | 182 | $31,058 |
| Ford F-150 | 257 | 150 | $30,923 |
| Toyota Camry | 111 | 111 | $29,566 |
| Toyota Corolla | 111 | 111 | $23,133 |
| Honda CR-V | 109 | 109 | $30,017 |
| Toyota RAV4 | 105 | 105 | $30,302 |
| Toyota Tacoma | 79 | 79 | $31,960 |
| GMC Sierra 1500 | 37 | 37 | $32,349 |
| Toyota Tundra | 12 | 12 | $32,537 |
| Ram 1500 (after fix, 13:59 UTC sync) | 100 | 100 | $29,730 |

## Open items (in priority order)

### 1. Auto.dev fails with "Too many subrequests" — upgraded, verify next sync

**Status 2026-09-28:** the account was upgraded to **Workers Paid**, but a sync at
13:59 UTC right after the upgrade still hit the old 50-request cap. `wrangler.jsonc`
now sets `limits.subrequests: 10000` explicitly, and that redeploy forces the paid
cap. Confirm the next sync's `sources_summary` shows Auto.dev `completed`. If the
deploy is ever rejected for this limit, the account is on Free again.

Every sync since the 10-vehicle change logs this for Auto.dev:

> Too many subrequests by single Worker invocation.

The Cloudflare account appears to be on the **Workers Free** plan, which caps a
single run at **50 outgoing requests**. The paid plan's cap is 10,000, which this
sync wouldn't reach. Ten vehicles × paginated searches on two providers exceed
that. MarketCheck finishes first and uses most of the budget, and Auto.dev hits the
cap. With the Ram fix, MarketCheck makes about 3 more calls per run.

Options:
- **Recommended:** upgrade to **Workers Paid ($5/month)**. The cap becomes 10,000
  requests per run and no code change is needed.
- **Stay free:** split the sync so each provider runs in its own invocation, for
  example two cron triggers. This is a real code change, because the "mark missing
  listings inactive" step currently assumes one run covers both providers.
- **Stay free, simpler:** cut `MAX_ROWS_PER_TARGET` (`server/sources/types.ts`) or
  the number of vehicles. This means less data.

### 2. Ram 1500 returned nothing — fixed and live

MarketCheck names this truck `Ram 1500 Pickup` / `Ram 1500 Classic`, and a search
for model `1500` returns zero. The fix (`server/sources/types.ts`,
`marketcheck.ts`, `autodev.ts`) searches MarketCheck with its names, then stores
results under the app's standard model `1500` so filtering and scoring still match.
MarketCheck shows about 120 qualifying Ram 1500s within 45 miles. The first sync after
the fix stored 100, the per-vehicle cap (`MAX_ROWS_PER_TARGET`).

### 3. Leftover integrations on this repo

Every push still triggers services that don't host this app:
- **Netlify** (`auto-deal-intel`) builds a preview for every PR. It's harmless but
  noisy; disconnect it in Netlify if it isn't used.
- **Supabase Preview** check. This app doesn't use Supabase, so disconnect the
  GitHub integration in Supabase.
- **Vercel** (`sa-auto-match`) is turned off for this repo through `vercel.json`
  (`git.deploymentEnabled: false`).

### 4. Stale branches

`cloudflare-test`, `import/full-source`, `master`, `railway/fix-deploy-865d4d` and
`railway/fix-deploy-f8d3de` are left over from the Railway/Replit era. Review them
and delete the ones no longer needed.

## How it works

```
Cron (12:00 UTC daily) ─┐
"Run sync now" button ──┴─> Worker: runTrackedSync
                              ├─ ensureVehicleTargets (seed missing defaults into D1)
                              ├─ MarketCheck + Auto.dev, in parallel, per vehicle
                              ├─ filter → normalize → dedupe by VIN
                              ├─ write listings / price snapshots, mark missing inactive
                              └─ score deals, rebuild market segments
Browser ─> Worker static assets (React dashboard) ─> /api/* ─> D1
```

| Piece | Where |
|---|---|
| Worker entry, API routes, cron | `worker/index.ts` |
| Sync pipeline, scoring | `server/engine/jobs.ts`, `server/engine/scoring.ts`, `server/engine/market-value.ts` |
| Providers | `server/sources/marketcheck.ts`, `server/sources/autodev.ts`, `server/sources/http.ts` (retries, API-key redaction) |
| Search settings | `server/sources/types.ts` |
| Scoring tables (reliability, local demand, segments) | `server/engine/constants.ts` |
| Database access | `server/storage.ts` |
| Schema | `migrations/0001`–`0006` (D1) |
| Dashboard | `client/src/pages/Home.tsx`, `client/src/components/RunSyncButton.tsx` |
| Build/deploy config | `wrangler.jsonc`, `vite.config.cloudflare.ts` |

### Search settings (`server/sources/types.ts`)

| Setting | Value |
|---|---|
| Center | ZIP **78250** (NW San Antonio), centroid 29.5058, -98.6655 |
| Radius | **45 miles** |
| Price | $10,000 – $35,000 |
| Mileage | ≤ 90,000 |
| Model year | 2020+ |
| Vehicles | F-150, Silverado 1500, Camry, Ram 1500, Tacoma, Sierra 1500, Tundra, RAV4, CR-V, Corolla |

**The vehicle list lives in two places.** The code list (`TARGET_VEHICLES`) is the
default. The D1 table `vehicle_targets` is what the sync actually uses. Each sync
adds any default missing from the table, but never re-activates a vehicle that was
turned off. To remove a vehicle, deactivate it with `DELETE /api/admin/targets/:id`.
Deleting it from the code alone won't remove it.

**Where the top 10 came from:** ranks 1–5 come from San Antonio used-market share
data (KSAT / San Antonio Current). Ranks 6–10 are a judgment call combining 2025
national sales with Toyota's strength in San Antonio.

## Operating it

### Secrets (Cloudflare → Workers & Pages → deal-intel-sa → Settings → Variables and Secrets)

| Name | Required | Purpose |
|---|---|---|
| `MARKETCHECK_API_KEY` | yes | MarketCheck inventory |
| `AUTODEV_API_KEY` | yes | Auto.dev inventory |
| `ADMIN_TOKEN` | for admin features | Password for "Run sync now", `/api/admin/*`, `/api/leads` (read) |

The admin password check ignores stray leading or trailing spaces, but is otherwise
exact and case-sensitive.

### Running a sync by hand

Use the **Run sync now** button on the dashboard and enter `ADMIN_TOKEN`. It shows
per-provider results and the real error if something fails. Or from a terminal:

```
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://<worker-url>/api/jobs/sync
```

### API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/health` | — | Liveness and current search settings |
| `GET /api/deals/top?min_score&limit` | — | Scored deals |
| `GET /api/listings/:id` | — | One listing and its price history |
| `GET /api/stats/overview`, `GET /api/stats/market` | — | Dashboard stats |
| `GET /api/jobs/status` | — | Last 10 sync runs |
| `POST /api/leads` | — | Lead capture (landing pages) |
| `GET /api/leads`, `…/:id/status` | admin | Read and update leads |
| `GET`/`POST /api/admin/targets`, `DELETE /api/admin/targets/:id` | admin | Manage the vehicle list |
| `POST /api/jobs/sync` | admin | Run a sync now |

### Checking health

- **Sync history:** `GET /api/jobs/status`, or query the `sync_runs` table in D1.
  `sources_summary` has per-provider status and errors.
- **Logs:** Cloudflare dashboard → deal-intel-sa → Logs (observability is enabled).

### Deploying

Merge to `main`. Cloudflare Workers Builds runs `npm run build` and
`npx wrangler deploy`. Each PR also gets a preview build; check its "Workers Builds"
status before merging.

**Database migrations are not applied automatically.** After adding a file to
`migrations/`, run `npm run db:migrate:remote` once (requires `wrangler login`).
All six current migrations are applied. `0006` was applied before `0005`, which
is harmless.

### Local development

```
npm ci
npm run db:migrate:local
# create .dev.vars with MARKETCHECK_API_KEY and AUTODEV_API_KEY
npm run dev          # Vite + Worker at http://localhost:5173
npm run check        # Worker types + typecheck
npm run build
```

## Gotchas already hit (don't reintroduce)

- **Blank screen:** the Cloudflare build must use the automatic JSX runtime
  (`esbuild.jsx: "automatic"` in `vite.config.cloudflare.ts`). The components don't
  import React.
- **Deploy found no assets:** Vite's root is `client/`, so the build also writes
  `.wrangler/deploy/config.json` at the repo root for `wrangler deploy` to find.
  Keep the `writeRootDeployRedirect` plugin.
- **Provider model names vary** ("F-150" vs "f150", "CR-V" vs "crv", "Sierra 1500"
  vs "sierra", "Ram 1500 Pickup" vs "1500"). Scoring lookups go through
  `lookupByMakeModel` / `getVehicleSegment`, and MarketCheck queries go through
  `marketCheckModelQuery`. When adding a vehicle, check its exact model name in
  MarketCheck first.
- **Request budget:** every vehicle adds outgoing requests per run. Watch Open item
  #1 before adding more vehicles.

## Change history (this cleanup)

| PR | Change |
|---|---|
| #4 | Cloudflare deploy fix; Vercel builds disabled for this repo |
| #5 | Blank-screen fix (JSX runtime) |
| #6 | 45 miles from 78250; San Antonio top-10 vehicles; scoring-key fix |
| #7 | "Run sync now" button; mobile header layout |
| #8 | Admin password tolerates stray whitespace; no autofill; show-password toggle |
| this PR | Ram 1500 search fix; this handoff |
