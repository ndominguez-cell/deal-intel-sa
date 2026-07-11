# SA Auto Match — Lead Funnel (POC)

A bootstrap auto-dealer lead-generation funnel. Meta ads drive traffic to a neutral-branded landing page; leads flow into Supabase, spawn a ClickUp task, optionally email the salesperson, and fire the Meta **Lead** pixel on the thank-you page.

Stack: **Next.js 14 (App Router)** · **Vercel** · **Supabase** · **ClickUp** · **Resend** · **Meta Pixel**.

---

## 1. Lead flow overview

```
Meta ad (SA Auto Match)
      │  click (UTMs preserved)
      ▼
Funnel page  ( / )
      │  form submit (name, phone, vehicle, angle, UTMs)
      ▼
POST /api/leads
      ├── insert row → Supabase table `auto_leads`
      ├── create task → ClickUp list 901114100607
      └── (optional) email salesperson via Resend
      ▼
Redirect → /thanks
      └── fires Meta Pixel `Lead` event
```

**The goal:** every real lead hits the salesperson's phone within seconds so they can text back within 5 minutes.

---

## 2. Prerequisites

- Node.js 18+ and npm
- Accounts: **Vercel**, **Supabase**, **ClickUp**, **Resend**, **Meta Business** (with a pixel)
- A **GitHub** repo to connect to Vercel
- A **neutral domain** (e.g. `saautomatch.com`) — do NOT use the dealership's brand
- The Supabase `auto_leads` table and ClickUp list `901114100607` already exist in the user's accounts

---

## 3. Local development

```bash
git clone <your-repo-url>
cd sa-auto-match
npm install

# create your local env file (see table below)
cp .env.example .env.local   # then fill in values

npm run dev
# open http://localhost:3000
```

Submit a test lead locally to confirm the API route responds and the row lands in Supabase before you ever deploy.

---

## 4. Environment variables

Set these in `.env.local` for local dev and in **Vercel → Project → Settings → Environment Variables** for production.

| Variable | Required | Where to get it |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase → Project Settings → **Data API** → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Project Settings → **API Keys** → `service_role` secret. **Server-side only — never expose to the client.** |
| `CLICKUP_API_TOKEN` | ✅ | ClickUp → Settings → **Apps** → Generate personal API token (`pk_...`) |
| `CLICKUP_LIST_ID` | ✅ | Fixed: **`901114100607`** |
| `RESEND_API_KEY` | optional | Resend → **API Keys** → Create (`re_...`). Omit to skip salesperson email |
| `ALERT_EMAIL_FROM` | optional | A verified sender on your Resend domain (e.g. `leads@saautomatch.com`) |
| `ALERT_EMAIL_TO` | optional | The salesperson's / manager's email for lead alerts |
| `NEXT_PUBLIC_META_PIXEL_ID` | ✅ | Meta Events Manager → your Pixel → **Settings** → Pixel ID. `NEXT_PUBLIC_` prefix required so it's readable in the browser |

> Anything **not** prefixed `NEXT_PUBLIC_` stays server-side. The service role key and ClickUp token must never reach the browser.

---

## 5. Supabase setup

1. Open your Supabase project → **SQL Editor**.
2. Paste and run `supabase/migration.sql` (creates/confirms the `auto_leads` table and columns).
3. Confirm the table exists under **Table Editor → `auto_leads`**.
4. Grab `SUPABASE_URL` and the `service_role` key for your env vars (step 4).

`auto_leads` captures at minimum: name, phone, vehicle of interest / current vehicle, the funnel angle (`tradein` / `payment` / `freshdeals`), the UTM params, and a created-at timestamp.

---

## 6. ClickUp setup

1. **List:** use the existing list **`901114100607`**.
2. **Custom statuses (do this in the ClickUp UI — the API cannot create statuses):**
   - Go to the list → **List settings → Statuses** and add, in order:
     `NEW → CONTACTED → APPT SET → SHOWED → SOLD → LOST`
   - New leads land in **NEW**; the salesperson walks each lead down the pipeline.
3. **Add the salesperson as a guest:**
   - Invite them to the list as a **Guest**.
   - Make sure **mobile push notifications** are ON so new tasks buzz their phone instantly.
   - Have them install the ClickUp mobile app and log in before go-live.
4. Generate `CLICKUP_API_TOKEN` (step 4) — the API uses it to create a task in this list per lead.

> ⚠️ **Statuses cannot be created via the API.** If you skip the manual UI step, task creation will fail or dump tasks into a default status. Do it first.

---

## 7. Vercel deploy

1. Push the repo to **GitHub**.
2. In **Vercel → Add New → Project**, import the GitHub repo.
3. Framework preset auto-detects **Next.js**. Leave build command as `next build`.
4. Add **all env vars** from step 4 (Production scope). Double-check `CLICKUP_LIST_ID=901114100607` and the Meta pixel ID.
5. **Deploy.**
6. **Domain:** Vercel → Project → **Settings → Domains** → add the neutral domain (e.g. `saautomatch.com`) and follow the DNS instructions. Wait for SSL to go green.
7. Confirm the live site loads at the neutral domain and the form renders on mobile.

---

## 8. END-TO-END FAKE-LEAD TEST — do this BEFORE spending a dollar

**Do not run a single ad until this full chain is verified on production.**

1. On the **live domain**, open the funnel on a **real phone**.
2. Submit **one fake lead** with a real phone/email you control (e.g. name "TEST LEAD", your own number).
3. Verify the chain end to end:
   - [ ] Row appears in **Supabase `auto_leads`** with the correct fields + UTMs
   - [ ] A **task appears in ClickUp list `901114100607`** in status **NEW**
   - [ ] The **salesperson's phone** gets the ClickUp push notification
   - [ ] (If Resend configured) the **alert email** arrives at `ALERT_EMAIL_TO`
   - [ ] Redirect to **`/thanks`** happens and the **Meta Pixel `Lead` event** fires (verify in Meta **Events Manager → Test Events** or with the Meta Pixel Helper browser extension)
4. Delete the test task/row (or mark **LOST**) so it doesn't pollute POC numbers.
5. Have the **salesperson do a live dry run:** they receive the notification, open the task, and practice texting back within 5 minutes.

If any link in the chain fails, fix it and re-test. A broken chain = paid clicks with no leads = burned money.

---

## 9. Go-live checklist

- [ ] `supabase/migration.sql` run; `auto_leads` confirmed
- [ ] ClickUp statuses `NEW/CONTACTED/APPT SET/SHOWED/SOLD/LOST` created in UI
- [ ] Salesperson added as ClickUp guest with mobile notifications ON + app installed
- [ ] All env vars set in Vercel (prod), incl. `CLICKUP_LIST_ID=901114100607` and `NEXT_PUBLIC_META_PIXEL_ID`
- [ ] Neutral domain live with valid SSL; funnel loads on mobile
- [ ] Meta Pixel installed and `Lead` event verified firing on `/thanks`
- [ ] End-to-end fake-lead test passed (Supabase → ClickUp → phone → email → pixel)
- [ ] Funnel copy/landing page has **no** credit/financing/approval language (matches AD-PACK compliance)
- [ ] Privacy policy link present on the form
- [ ] UTM params confirmed captured and stored per lead
- [ ] Salesperson briefed on the 5-minute SLA and status workflow
- [ ] Test lead cleaned up
- [ ] Only now: launch Meta ads (see `docs/AD-PACK.md`)

---

## 10. Salesperson SLA (the whole POC lives or dies here)

- **Text every new lead within 5 minutes** of the ClickUp notification. Speed-to-lead is everything — 5 minutes vs. 30 minutes can multiply contact rates.
- **First touch = a text**, then a call. Keep it human, reference their vehicle interest, offer a quick appointment.
- **Move the ClickUp status** as reality changes: `NEW → CONTACTED → APPT SET → SHOWED → SOLD` (or `LOST` with a reason). Clean statuses are how we measure the POC and prove it to the next dealer.
- **Log the outcome** so we can report CPL → appt → show → sold back to the funnel.
- Keep **mobile notifications on** during business hours. A lead that sits is a lead that's gone.
