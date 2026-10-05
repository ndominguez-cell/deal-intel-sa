# Deal Intel SA

Deal Intel SA is a Cloudflare Workers application that finds promising used
truck opportunities in the San Antonio market. It combines licensed inventory
from MarketCheck and Auto.dev, stores current and historical listing data in
Cloudflare D1, and calculates deal scores from local comparables.

## Automated inventory flow

The Worker runs once per day at `12:00 UTC`:

1. Query MarketCheck and Auto.dev concurrently in bounded, paginated batches.
2. Apply the active D1 vehicle targets, then keep listings that are model year
   2020 or newer, priced from $10,000 to $35,000, have no more than 90,000 miles,
   and are within 45 miles of San Antonio.
3. Normalize both providers into one schema and deduplicate by VIN.
4. Insert new vehicles, update existing vehicles, and record price changes.
5. Mark listings that disappeared from a successful full import as inactive.
6. Recalculate deal scores and San Antonio market segments.

The eligibility rules are enforced again after every provider response and the
price ceiling is enforced before every database write, so a source-filter
change cannot import an out-of-scope vehicle.

The application database is the Cloudflare D1 binding named `DB`; there is no
Railway service, `DATABASE_URL`, database hostname, or database password.

## Cloudflare setup

Install dependencies and create the D1 database:

```bash
npm ci
npx wrangler login
npx wrangler d1 create deal-intel-sa-db
```

Copy the returned database ID into `wrangler.jsonc`, replacing
`replace-with-your-d1-database-id`, then apply the schema:

```bash
npm run db:migrate:remote
```

Configure the two required production secrets. An optional admin token enables
authenticated manual syncs:

```bash
npx wrangler secret put MARKETCHECK_API_KEY
npx wrangler secret put AUTODEV_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

Build and deploy:

```bash
npm run check
npm run build
npm run deploy:cloudflare
```

Cloudflare Cron uses UTC. The configured `0 12 * * *` schedule runs once each
day at 12:00 UTC (morning in San Antonio).

## Local development

Apply the D1 migration locally, then run the Worker-backed Vite application:

Create `.dev.vars` beside `wrangler.jsonc` with the two required local secrets:

```dotenv
MARKETCHECK_API_KEY=your_marketcheck_key
AUTODEV_API_KEY=your_auto_dev_key
```

```bash
npm run db:migrate:local
npm run dev
```

Health check:

```bash
curl http://localhost:5173/api/health
```

To test the scheduled handler locally, start Vite and request:

```bash
curl "http://localhost:5173/cdn-cgi/handler/scheduled?format=json"
```

Manual production syncs are intentionally protected:

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://YOUR_WORKER_DOMAIN/api/jobs/sync
```

## Production and Facebook campaign

- Canonical Worker: `https://deal-intel-sa.ndominguez.workers.dev`
- Campaign entry point: `/today`
- Build artifact and deploy config: `dist/public/deal_intel_sa/wrangler.json`
- D1 binding: `DB` → `deal-intel-sa-db`

Campaign query parameters (`utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `utm_term`, and `fbclid`) are retained for the browser session
and passed into vehicle landing pages. Lead submissions persist `utm_source`
and `utm_campaign`.

Set `META_PIXEL_ID` to the public Meta Pixel ID to activate PageView, Search,
ViewContent, Lead, SelectDeal, and StartAvailabilityRequest events. Leaving it
empty keeps the application functional without loading Meta's script.

The campaign strategy, ad copy, and creative board are in [`marketing/`](marketing/).

After deployment, verify the homepage, `/today`, a vehicle route,
`/api/health`, `/api/deals/top`, and a Turnstile-protected lead request on the
production hostname.
