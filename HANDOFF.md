# Deal Intel SA — Handoff

**Updated:** 2026-09-28
**Owner:** ndominguez-cell · **Repo:** `ndominguez-cell/deal-intel-sa` · **Branch deployed:** `main`

Deal Intel SA finds good used-vehicle deals in the San Antonio market. Once a day it
pulls licensed dealer inventory from **MarketCheck** and **Auto.dev**, stores it in
Cloudflare D1, scores each listing against local comparables, and shows the best
deals on a dashboard.

## Current state (checked live 2026-09-28, 14:20 UTC sync)

- **Live on Cloudflare Workers** (Worker `deal-intel-sa`), on the **Workers Paid**
  plan. Pushes to `main` deploy automatically through Cloudflare Workers Builds.
- **Both providers are syncing.** The 14:20 UTC sync completed for MarketCheck
  (1,202 found, 809 kept) and Auto.dev (989 found, 668 kept). After de-duplicating
  by VIN, 1,015 listings were written.
- **All 10 vehicles have listings.** 0 leads captured so far.

Active listings after the 14:20 UTC sync:

| Vehicle | Active | Avg price |
|---|---|---|
| Toyota Camry | 145 | $29,179 |
| Toyota Corolla | 141 | $22,176 |
| Toyota RAV4 | 135 | $29,746 |
| Chevrolet Silverado 1500 | 132 | $31,578 |
| Honda CR-V | 123 | $30,107 |
| Ford F-150 | 110 | $30,551 |
| Ram 1500 | 100 | $29,730 |
| Toyota Tacoma | 77 | $31,919 |
| GMC Sierra 1500 | 40 | $32,199 |
| Toyota Tundra | 12 | $32,492 |

Each provider stores at most 100 listings per vehicle per sync (`MAX_ROWS_PER_TARGET`),
so Ram 1500 at exactly 100 is hitting that cap.

## Open items (in priority order)

### 1. Auto.dev "Too many subrequests" — resolved

Going from 2 to 10 vehicles pushed each sync past the Workers Free plan's
50-request cap, so Auto.dev failed on every run. Fixed on 2026-09-28: the account
was upgraded to **Workers Paid**, and `wrangler.jsonc` sets
`limits.subrequests: 10000`. The limit had to be set explicitly; a sync right after
the upgrade still hit the old cap until the redeploy. If a deploy is ever rejected
for this limit, the account has dropped back to Free.

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

## Next project: port the Texas Used Car Market Index from Auto-Intel

A statewide Texas used-car price index page was built for the older Express/Vercel
app in the **Auto-Intel** repo and needs to be ported into this Cloudflare Worker.

### Where the code is

- **Repo:** `ndominguez-cell/Auto-Intel`, branch **`claude/quirky-turing-u9kfsy`**
  (commit `f763e9a`). **PR #4** ("Add Texas Used Car Market Index") stays open as
  the reference copy. Don't merge or close it as part of the port.
- **Files to reuse**, all under `Deal-Intel-SA/` in that repo:

| File | What it is | Port approach |
|---|---|---|
| `server/market-index/texas.ts` (437 lines) | Types, pure index math, MarketCheck client, report builder, sample report | Copy almost as-is. It only uses `fetch`, `URL` and `setTimeout`, all available in Workers. |
| `server/market-index/texas.test.ts` (110 lines) | `node:test` unit tests (run there with `tsx --test`) | Copy. This repo has no test script yet, so add `"test": "tsx --test server/**/*.test.ts"` and `tsx` as a dev dependency. |
| `client/src/pages/TexasIndex.tsx` (360 lines) | React page with the headline, index chart, segment/metro/make tables | Copy, then fix one import: it uses `@/components/SiteHeader`, which **doesn't exist here**. This repo's header is inline in `client/src/pages/Home.tsx`, so either extract it into a shared component or render a simple header. `recharts` and `@/lib/api` (`apiRequest`) are already present and compatible. Add route `/texas-index` in `client/src/App.tsx` and a link from the Home header nav. |

For reference only (not copied as-is): `server/market-index/job.ts` (the refresh job,
23 lines) and three routes in `server/routes.ts` at lines 315–350.

### What the feature does

It uses two MarketCheck endpoints: `/v2/search/car/active` (current inventory) and
`/v2/search/car/recents` with `sold=true` (listings that left the market). It builds:

- A **12-week, mix-adjusted price index** (base = 100). Each week's median sold
  price per body segment (SUV, Pickup, Sedan, Other) is weighted by that segment's
  share of sales, so a shift in what sold doesn't move the index; only price
  changes do.
- Snapshots by segment, for 7 metros (Houston, DFW, San Antonio, Austin, El Paso,
  RGV, Corpus Christi; 35-mile radius each), and for the top makes: active supply,
  30-day sales, median ask and sold price, days of supply, and days on market.

### Cloudflare changes needed

1. **Cron Trigger instead of Vercel Cron.** Auto-Intel refreshes daily at
   `15 11 * * *` through Vercel Cron hitting `GET /api/cron/market-index/texas` with a
   `CRON_SECRET`. Here, add a second entry to `triggers.crons` in `wrangler.jsonc`
   (for example `"15 11 * * *"`). The existing `scheduled()` handler in
   `worker/index.ts` currently always runs the inventory sync, so it must switch on
   `controller.cron` to run the right job. Drop the cron HTTP route and
   `CRON_SECRET`; keep the admin-only manual refresh
   (`POST /api/jobs/market-index/texas`) behind `isAuthorized` / `ADMIN_TOKEN`.
2. **Storage in D1** (this repo uses D1 binding `DB`, not Hyperdrive or Postgres).
   Auto-Intel stores each report in a Postgres table `market_index_reports`
   (`id`, `region`, `source`, `as_of`, `payload jsonb`, `created_at`, index on
   `(region, as_of)`). Add `migrations/0007_market_index_reports.sql` with the same
   columns, storing `payload` as JSON text, plus `saveMarketIndexReport` /
   `getLatestMarketIndexReport` on `DatabaseStorage` in `server/storage.ts`.
   **Migrations are not applied by deploys.** Run `npm run db:migrate:remote` once
   after merging, or the first refresh will fail.
3. **Secrets:** reuse the existing `MARKETCHECK_API_KEY`. Nothing new is needed.
4. **Routes:** `GET /api/market-index/texas` (public) returns the latest stored
   report, or the sample report if there is none, plus `marketCheckConfigured`. Add
   it to `handleDatabaseRequest` in `worker/index.ts`.

### API usage and the subrequest limit

Each refresh makes about **81 MarketCheck calls**: 12 weeks × 4 segments = 48 weekly
calls, plus 33 snapshot calls (4 statewide + 8 segment + 21 metro). The client
retries a 429 up to 3 times, so the worst case is about 324 calls. The existing
inventory sync already uses a large share of the per-run budget. The Worker is on
**Workers Paid** with `limits.subrequests: 10000`, so the index fits, but:
- Check that `limits.subrequests` is still set before shipping. On the Free plan's
  50-request cap, this job fails every time.
- Run it as its **own cron invocation**, not inside the inventory sync. Each gets
  its own budget and a failure in one can't block the other.
- Consider routing its calls through `server/sources/http.ts`, which already
  retries and redacts the API key from error messages. `createMarketCheckFetch`
  puts the key in the URL but doesn't include the URL in its errors, so either is
  safe.
- Watch the MarketCheck plan quota: this adds about 81 calls a day on top of the
  inventory sync.

### Sample data: labeled, and trends never simulated

The page shows sample data until the first live refresh. It must be labeled
("Sample data" badge and banner; the page already does this when
`report.source === "demo"`), and **the trends must never be simulated.**

> ⚠️ **The current Auto-Intel code breaks the second rule.** `buildDemoTexasIndex()`
> in `texas.ts` fabricates the 12-week series with a sine wave (`Math.sin(...)`),
> so the index chart and the 1-, 4- and 12-week changes in sample mode are made-up
> movement. Its own comment and the page banner call the weekly movement
> "illustrative". Fix this during the port:
> - The sample report returns `series: []` and `null` for `change1w`, `change4w`,
>   `change12w` and each segment's `change4w`.
> - `TexasIndex.tsx` hides the index chart and the change figures when
>   `report.source === "demo"`, and shows something like "Trend appears after the
>   first live refresh."
> - Update the banner wording and the `texas.test.ts` expectations to match.
>
> The labeled sample snapshot figures can stay: statewide totals from a real
> September 2026 pull, and illustrative metro and make splits.

These are **not** simulation, so keep them in the live path:
- `computeIndexSeries` carries a segment's last real median forward for weeks
  with fewer than 30 sales.
- `mergeWeeks` combines stored weeks with fresh ones.
- `job.ts` only reuses a previous series when `previous.source === "marketcheck"`,
  so sample numbers never seed live data.
- `job.ts` refuses to save a refresh that returned nothing, so the last good
  report stays up.

### Done when

- `npm run check`, `npm run build` and the ported tests pass.
- The migration is applied remotely.
- A manual refresh (`POST /api/jobs/market-index/texas` with `ADMIN_TOKEN`) stores
  a `source: "marketcheck"` report, and the page shows it with the sample banner
  gone.
- The daily cron entry is in `wrangler.jsonc`, and the next scheduled run succeeds.

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
- **Request budget:** every vehicle adds outgoing requests per run. The Worker runs
  on Workers Paid with `limits.subrequests: 10000` in `wrangler.jsonc`; don't remove
  it or drop back to the Free plan, which caps a run at 50.

## Change history (this cleanup)

| PR | Change |
|---|---|
| #4 | Cloudflare deploy fix; Vercel builds disabled for this repo |
| #5 | Blank-screen fix (JSX runtime) |
| #6 | 45 miles from 78250; San Antonio top-10 vehicles; scoring-key fix |
| #7 | "Run sync now" button; mobile header layout |
| #8 | Admin password tolerates stray whitespace; no autofill; show-password toggle |
| #9 | Ram 1500 search fix; this handoff |
| #10 | Explicit Workers Paid subrequest limit (Auto.dev syncing again) |
| #11 | Handoff updated with the post-fix sync results |
