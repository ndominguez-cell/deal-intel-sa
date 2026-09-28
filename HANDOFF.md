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
Cron (11:15 UTC daily) ───> Worker: refreshTexasIndex (~81 MarketCheck calls)
                              └─ store report in market_index_reports
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
| Texas market index | `server/market-index/` (see its section below) |
| Schema | `migrations/0001`–`0007` (D1) |
| Dashboard | `client/src/pages/Home.tsx`, `client/src/components/RunSyncButton.tsx`, `client/src/pages/TexasIndex.tsx` |
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
| `GET /api/market-index/texas` | — | Latest Texas market index report (sample until the first refresh) |
| `POST /api/jobs/market-index/texas` | admin | Refresh the Texas market index now |

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
npm test             # unit tests (server/**/*.test.ts)
npm run build
```

## Texas Used Car Market Index (`/texas-index`)

A statewide Texas used-car price index page, ported from the older Express/Vercel
app in the **Auto-Intel** repo (branch `claude/quirky-turing-u9kfsy`, commit
`f763e9a`). **Auto-Intel PR #4** stays open there as the reference copy; don't merge
or close it. It's linked as "Texas Index" in the dashboard header.

| Piece | Where |
|---|---|
| Index math, MarketCheck client, report builder, sample report | `server/market-index/texas.ts` |
| Unit tests (`npm test`) | `server/market-index/texas.test.ts` |
| Refresh job | `server/market-index/job.ts` |
| Storage | `market_index_reports` table (`migrations/0007`), `saveMarketIndexReport` / `getLatestMarketIndexReport` in `server/storage.ts` |
| Routes and cron dispatch | `worker/index.ts` |
| Page | `client/src/pages/TexasIndex.tsx` |

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

### How it runs on Cloudflare

- **Daily cron at 11:15 UTC** (`15 11 * * *`, the second entry in
  `triggers.crons`), 45 minutes before the inventory sync. `scheduled()` in
  `worker/index.ts` runs the index refresh when `controller.cron` matches
  `TEXAS_INDEX_CRON` and the inventory sync for any other cron. If you retime the
  index cron, change both places. Auto-Intel's Vercel Cron route and `CRON_SECRET`
  were dropped.
- **Manual refresh:** `POST /api/jobs/market-index/texas` with the `ADMIN_TOKEN`
  bearer token. It returns the real error with a 502 if the refresh fails.
- **Public read:** `GET /api/market-index/texas` returns the latest stored report,
  or the sample report if none exists, plus `marketCheckConfigured`.
- **Storage:** each refresh inserts one row into D1 `market_index_reports`
  (payload stored as JSON text). The page reads the newest row.
- **Secrets:** reuses `MARKETCHECK_API_KEY`. Nothing new.
- **Job history:** each refresh logs a `jobs_runs` row with `job_type =
  'market_index_tx'`, and the cron logs `texas_market_index_refresh_completed` /
  `_failed` events.

### API usage and the subrequest limit

Each refresh makes about **81 MarketCheck calls**: 12 weeks × 4 segments = 48 weekly
calls, plus 33 snapshot calls (4 statewide + 8 segment + 21 metro). Calls go through
`server/sources/http.ts` (3 attempts on 429/5xx, 20 s timeout, API key redacted
from errors), so the worst case is about 243. It runs as its own cron invocation,
so it has its own budget and a failure can't block the inventory sync. This needs
**Workers Paid** with `limits.subrequests` set; on the Free plan's 50-request cap
it fails every time. It adds about 81 MarketCheck calls a day to the plan quota.

### Sample data: labeled, and trends never simulated

Until the first live refresh, the page shows a sample report with a "Sample data"
badge and banner (`report.source === "demo"`). **Trends are never simulated.**
Auto-Intel's sample report drew its 12-week series with a sine wave; the port
removed that:
- `buildDemoTexasIndex()` returns `series: []`, and `indexValue`, the 1-, 4- and
  12-week changes, each segment's `change4w` and each metro's `priceChange30d`
  are all `null`.
- The page hides both charts and the change figures unless the report is live
  with a real series, and shows "The trend appears after the first live refresh."
- Tests in `texas.test.ts` lock this in.

The sample snapshot figures stay, labeled: statewide totals from a real September
2026 MarketCheck pull, and illustrative segment, metro and make splits.

These are **not** simulation, so they stay in the live path:
- `computeIndexSeries` carries a segment's last real median forward for weeks
  with fewer than 30 sales.
- `mergeWeeks` combines stored weeks with fresh ones.
- `job.ts` only reuses a previous series when `previous.source === "marketcheck"`,
  so sample numbers never seed live data.
- `job.ts` refuses to save a refresh that returned nothing, so the last good
  report stays up.

### Checking it

- After the first refresh, the page shows "Source: MarketCheck" and the sample
  banner is gone.
- In D1: `SELECT id, source, as_of FROM market_index_reports ORDER BY id DESC LIMIT 5;`
  and `SELECT * FROM jobs_runs WHERE job_type = 'market_index_tx' ORDER BY id DESC LIMIT 5;`
- The trend builds up over time: the first live refresh already covers 12 weeks,
  and each daily refresh merges fresh weeks into the stored history.

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
| #12 | Texas Market Index port plan |
| #13 | Texas Used Car Market Index ported from Auto-Intel |
