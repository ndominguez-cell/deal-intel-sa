# Deploy Runbook — Railway (app) + Supabase (database)

This app is a long-lived Express server that serves both the API and the built
client on one port. Railway runs that as-is — no serverless refactor, the
20-minute reminder sweep and sessions keep working. Supabase is just the
Postgres database behind `DATABASE_URL`.

## What was added for deployment
- **`railway.json`** — tells Railway how to build (`npm ci && npm run build`) and start (`npm start`), and to health-check `/api/health`.
- **`engines.node`** pinned to `>=22 <23` in `package.json` — Railway builds on Node 22, the version this was validated against.
- Nothing else changed. Verified locally: `npm run build` produces `dist/index.cjs` + `dist/public/`, and the built bundle loads cleanly (fails only on the expected `DATABASE_URL` guard when no DB is set).

---

## Step 1 — Create the Supabase database
1. Create a project at supabase.com. Pick a region close to San Antonio (e.g. `us-east-1` or `us-west-1`).
2. Save the database password Supabase gives you at creation.
3. Get the connection string: **Project Settings → Database → Connection string → URI**.
   - For a long-lived server like Railway, use the **direct connection** string (port **5432**), not the pooler. (The pooler on 6543 is for serverless; you don't need it here.)
   - It looks like: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

## Step 2 — Create the schema in Supabase
From your machine, with the repo checked out:
```bash
npm ci
DATABASE_URL="postgresql://postgres:...@db.[REF].supabase.co:5432/postgres" npm run db:push
```
This runs `drizzle-kit push` and creates every table (listings, deal_scores,
leads, buyer_leads, appointments, jobs_runs, etc.) plus all the columns added
across v5–v9 (SMS status, dealer-notify status, score snapshots). Run this
once now, and again any time `shared/schema.ts` changes.

## Step 3 — Deploy the app on Railway
1. Push the repo to GitHub (`ndominguez-cell/deal-intel-sa`).
2. At railway.app: **New Project → Deploy from GitHub repo** → pick the repo.
   Railway detects `railway.json` and uses those build/start commands.
3. Set environment variables (**Variables** tab). Minimum to boot:
   - `DATABASE_URL` — the Supabase direct URI from Step 1
   - `NODE_ENV=production`
   - Leave `PORT` unset — Railway injects it and the server already reads `process.env.PORT`.
4. Deploy. When it's live, Railway gives you a URL and the `/api/health` check
   should go green.

## Step 4 — Add the feature env vars (optional, enable as needed)
All of these degrade gracefully if unset — the app runs fine without them, the
relevant feature just stays off. See `.env.example` for the full annotated list.
- **AI setter:** `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`)
- **SMS confirmations/reminders:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`. Point the Messaging Service's inbound webhook at `https://[your-railway-url]/api/sms/inbound`.
- **Dealer email notifications:** `DEALER_NOTIFY_EMAIL` + `SMTP_HOST/PORT/USER/PASS/FROM`, and/or `DEALER_NOTIFY_NUMBER` for SMS.
- **Live listing ingestion:** `MARKETCHECK_API_KEY` (+ optional `LIVE_INGEST_RADIUS_MILES`, `LIVE_INGEST_MAX_ROWS`).

## Step 5 — Point Facebook ads at the live URL
Once deployed: `https://[your-railway-url]/deals?dealer=<name>&utm_source=fb&utm_campaign=<unit>`

---

## Notes / gotchas
- **Reminder sweep just works.** The 20-min `setInterval` in `index.ts` runs inside Railway's long-lived process — no cron needed. (If you ever move to multiple Railway instances, you'd want to move that to a single scheduled trigger to avoid double-sends, but for one instance it's fine.)
- **Sessions** use in-memory `memorystore`, which is fine for a single instance. If you scale to multiple instances later, switch to the already-installed `connect-pg-simple` backed by the Supabase DB so sessions are shared.
- **`db:push` vs migrations.** `db:push` is quick and good for now. For a production audit trail you may later want generated SQL migrations (`drizzle-kit generate`), but that's not required to ship.
- **The esbuild allowlist** in `script/build.ts` names some packages that aren't installed (stripe, openai, etc.) — harmless leftovers; esbuild only bundles what's actually imported. Not worth touching pre-deploy.
- **Meta-image plugin** logs "no Replit deployment domain found" and skips — harmless. If you want correct Open Graph image URLs on the deployed domain, that plugin (`vite-plugin-meta-images.ts`) can be updated to read the Railway domain later; it doesn't affect functionality.

## Not verified in this environment
I couldn't boot the server against a live Postgres here (no local DB available) or take a browser screenshot of `/deals`. The build chain and bundle-load are verified; the DB-connected boot and a visual pass are worth doing once on Railway before pointing ad spend at it.
