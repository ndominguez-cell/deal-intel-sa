# SA Auto Match — Meta Ads Pack (POC)

**Brand:** SA Auto Match (neutral — do NOT use the dealership name in ads or on the funnel)
**Objective:** **Leads** (or **Sales/Conversions** optimizing for the **Lead** pixel event once the pixel has fired a few times)
**Total budget:** $50/day (ABO — budget set at the ad-set level so the primary angle is protected)
**Geo:** 15–20 mile radius around the single partner dealership address
**Platforms:** Facebook + Instagram, mobile-first

> **Before you launch:** swap every `https://sa-auto-match.vercel.app/...` link below for the live neutral domain (e.g. `https://saautomatch.com/...`). Keep the `?utm_...` query string exactly as written — the funnel and reporting depend on it.

---

## 0. Campaign structure at a glance

| Level | Setting |
|---|---|
| Campaign | Objective: **Leads**. Special Ad Category: **None** (see compliance). Budget type: **Ad set (ABO)** |
| Ad Set A — Trade-In (PRIMARY) | **$20/day** · `utm_content=tradein` |
| Ad Set B — SUV Utility | **$15/day** · `utm_content=utility` |
| Ad Set C — Current Inventory | **$15/day** · `utm_content=inventory` |

Total = **$50/day**. Trade-in is the horse we're betting on — it gets the biggest slice.

---

## 1. AD SET A — Trade-In Angle (PRIMARY · $20/day)

**Destination URL**
```
https://sa-auto-match.vercel.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=tradein
```

### Primary text — Variant A1
```
Thinking about upgrading? Start with what you already own.
Tell us what you're driving and what you want next, and we'll help organize your vehicle request.
Start online with no pressure, then request a visit when you're ready.
Get started 👇
```

### Primary text — Variant A2
```
Your trade-in is a useful starting point for your next vehicle.
Share a few details about what you drive and we'll help narrow down current local options.
It's fast, online, and there is no pressure to buy today.
Request your next step.
```

### Headlines (pick/rotate 3)
1. Start Your Vehicle Match Online
2. Begin With Your Trade-In Details
3. Request Your Next Vehicle Visit

### Description
```
Share your trade details and request a visit.
```

---

## 2. AD SET B — SUV Utility / Vehicle Fit Angle ($15/day)

**Destination URL**
```
https://sa-auto-match.vercel.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=utility
```

### Primary text — Variant B1
```
Need an SUV for everyday driving?
Tell us what matters most — room, features, or a trade-in — and we'll help narrow down current local options.
Start online, skip the guesswork, and request a visit when you're ready.
Find your SUV match 👇
```

### Primary text — Variant B2
```
Shopping for a practical SUV?
Answer a few quick questions and we'll match you to current local inventory based on what you want to drive.
It takes about a minute from your phone, then you can request a visit.
See your matches now.
```

### Headlines (pick/rotate 3)
1. Start Your SUV Request
2. Shop Local SUV Options
3. Submit Your Vehicle Request

### Description
```
Start your local SUV request online.
```

> **Compliance note for this angle:** keep the copy about vehicle type, features, availability, convenience, and the shopper's request. Do not present a financial offer.

---

## 3. AD SET C — Current Local Inventory Angle ($15/day)

**Destination URL**
```
https://sa-auto-match.vercel.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=inventory
```

### Primary text — Variant C1
```
Looking for a new SUV near San Antonio?
We track current local inventory and help shoppers compare options without starting at the dealership.
Tell us what you're looking for and request a visit when you find a fit.
See the current vehicle match options 👇
```

### Primary text — Variant C2
```
New arrivals and current local inventory change quickly.
Tell us what you want once and we'll help narrow down options that are available to confirm.
Takes under a minute from your phone.
Start your match before you visit.
```

### Headlines (pick/rotate 3)
1. Current SUV Options Near You
2. Request Local Vehicle Details
3. Explore Current Nissan SUVs

### Description
```
Request current SUV details before your visit.
```

---

## 4. COMPLIANCE — READ THIS TWICE

Meta's **Special Ad Category (Credit)** kicks in the moment your copy or landing page smells like a financial offer. That category **strips your targeting** (no tight radius, degraded delivery) and can get ads rejected or the account flagged. For a POC, that kills you.

### ❌ Never use — anywhere (ad copy, headlines, funnel, creative text overlays)
- Credit / credit score / "check your credit"
- Financing / finance / loan / lease terms / APR / interest rate / down payment
- "Guaranteed approval" / "approved" / "get approved" / "pre-qualify"
- "Bad credit OK" / "no credit" / "all credit welcome" / "bankruptcy OK"
- Specific monthly dollar figures tied to a payment offer (e.g. "$199/mo!")

### ✅ Safe — keep copy about the vehicle and the match
- Trade-in value, trade demand, "what your car is worth"
- Inventory, availability, "recently reduced," "new arrivals," price drops
- "Matches your budget," "fits what you want to spend" (feeling, not an offer)
- Speed / convenience / "all online" / "no lot visit needed"

### Compliance checklist (tick before every ad goes live)
- [ ] Special Ad Category set to **None** at campaign level
- [ ] No word from the ❌ list appears in any primary text, headline, or description
- [ ] Landing page has **no** financing/credit/approval language either (Meta reviews the destination)
- [ ] No specific payment/APR numbers in copy or on creative
- [ ] Brand shown is **SA Auto Match**, not the dealership
- [ ] Business/data-use disclaimers present on the funnel form (privacy link)

---

## 5. Launch settings (apply to all three ad sets)

| Setting | Value |
|---|---|
| Special Ad Category | **None** |
| Optimization | Leads → Lead event once pixel is warm; until then optimize for landing-page views only if lead volume is zero |
| Placements | **Advantage+ placements** to start (let Meta learn). If delivery skews to junk, switch to **Manual: Feeds + Reels + Stories** only |
| Devices | **Mobile only** (this funnel is a phone experience) |
| Geo | 15–20 mi radius around the dealership, **"People living in or recently in this location"** |
| Age | **25–65** |
| Gender | **All** |
| Detailed targeting | **Broad** — no interest stacking. Let the algo find buyers. Radius + age is the targeting |
| Schedule | Run continuously; **submit new ads early in the morning** so they clear review before the afternoon traffic |
| Creative | 1 video/reel + 1 static per ad set to start; vertical 9:16 or square 1:1 |

**Account tip:** launch from a **seasoned, warmed Meta ad account** with billing history — review clears faster and delivery stabilizes quicker than on a brand-new account.

**⚠️ Do NOT edit ads while they're "In Review."** Any edit **resets the review queue** and you lose your place in line. Get copy/creative right, submit once, leave it alone until approved.

---

## 6. FIRST-72-HOURS PLAYBOOK

Learning phase is noisy. Don't panic-edit on day one. Judge on **spend milestones**, not clock time.

### Metrics to track (log daily in a sheet)
| Metric | What it tells you |
|---|---|
| **Spend** | Money in per ad set |
| **CPL** (cost per lead) | Efficiency — the headline number |
| **Contact rate** | % of leads the salesperson actually reached |
| **Appt-set rate** | % of leads that booked an appointment |
| **Show rate** | % of appointments that showed up |
| **Sold** | Units closed (the only number that ultimately matters) |

### Target ranges (POC benchmarks — tune to the market)
- **Good CPL:** under **$15**
- **Acceptable CPL:** **$15–$30**
- **Danger CPL:** over **$30**

### 🔴 KILL criteria
- **Zero leads after $25 spent** on a single ad set → pause that ad set, revisit copy/creative/audience.
- **CPL over $40 after $40 spent** on an ad set → pause it.
- Any ad set where leads are consistently **junk / uncontactable** (contact rate < 20% after 10+ leads) → pause and inspect form/targeting.
- **Whole campaign:** if after **$150 total spend** (≈3 days) there are **zero appointments set**, stop and rework the offer or the salesperson follow-up before spending more.

### 🟢 SCALE criteria
- Any ad set holding **CPL under $15** *and* **appt-set rate ≥ 20%** → **duplicate the ad set** (fresh learning) or raise its budget by **+20–30% every 48h** (bigger jumps re-trigger learning).
- If **Trade-In (A)** is the winner (expected), shift budget from B/C into A while keeping one alt angle alive for creative diversity.
- Only scale on **appointments/shows**, not raw lead count — cheap leads that never show are a trap.

### Hour-by-hour cadence
- **0–24h:** hands off. Confirm ads approved and spending. Confirm leads are landing in Supabase → ClickUp → salesperson phone (you already ran the fake-lead test pre-launch).
- **24–48h:** first read on CPL and contact rate. Apply KILL rules only at their spend thresholds.
- **48–72h:** apply SCALE rules to any clear winner. Kill clear losers. Refresh creative on anything mediocre-but-alive.

---

## 7. Quick copy-swap reference (UTMs)

| Angle | utm_content | Live URL (swap domain) |
|---|---|---|
| Trade-in | `tradein` | `https://sa-auto-match.vercel.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=tradein` |
| SUV utility | `utility` | `https://sa-auto-match.vercel.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=utility` |
| Current inventory | `inventory` | `https://sa-auto-match.vercel.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=inventory` |

Constant across all: `utm_source=meta` · `utm_medium=paid_social` · `utm_campaign=sa-auto-match-poc`
