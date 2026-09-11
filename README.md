# Deal Intel SA

Deal Intel SA is a Cloudflare Workers application that finds promising used
truck opportunities in the San Antonio market. It combines licensed inventory
from MarketCheck and Auto.dev, stores current and historical listing data in
Cloudflare D1, and calculates deal scores from local comparables.

## Automated inventory flow

The Worker runs once per day at `12:00 UTC`:

1. Query MarketCheck and Auto.dev concurrently in bounded, paginated batches.
2. Keep Ford F-150 and Chevrolet Silverado 1500 listings that are model year
   2020 or newer, priced from $10,000 to $35,000, have no more than 90,000 miles,
   and are within 100 miles of ZIP code 78205.
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
