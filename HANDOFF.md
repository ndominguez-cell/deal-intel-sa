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
