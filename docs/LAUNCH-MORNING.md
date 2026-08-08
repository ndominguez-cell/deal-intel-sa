# SA Auto Match — launch this morning

This is the shortest safe path from the current build to paid lead traffic.

## What is ready in the code

- Mobile-first lead funnel with UTM capture.
- Vehicle type + trade-in details.
- Requested visit timing: `Today`, `Tomorrow`, `This week`, or `Just exploring`.
- Preferred contact window.
- Consent checkbox and honeypot.
- Lead saved to Supabase `auto_leads` first.
- ClickUp task created in `NEW`, with hot leads prioritized when the shopper wants a visit soon.
- Optional Resend alert.
- Thank-you page with Meta `Lead` event.
- Appointment handoff instruction: salesperson texts or calls within five minutes and confirms the visit.

## Campaign to build in Meta Ads Manager

- Campaign: `SA Auto Match — South Park Nissan — Appointment Leads`
- Objective: Leads
- Special Ad Category: None, subject to Meta's current review rules
- Budget: $50/day ABO
  - `tradein`: $20/day
  - `utility`: $15/day
  - `inventory`: $15/day
- Location: approved South Park Nissan service area; use the dealer-approved radius
- Audience: broad delivery, all genders, age range approved by the account owner; do not use sensitive targeting
- Placements: Advantage+ placements to start; mobile-first creative
- Destination: the neutral SA Auto Match domain, not a dealership-owned brand domain

## Ad links

Replace `LIVE_DOMAIN` with the verified production domain. Do not run ads to a preview URL that has not passed the fake-lead test.

```text
https://LIVE_DOMAIN/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=tradein
https://LIVE_DOMAIN/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=utility
https://LIVE_DOMAIN/?utm_source=meta&utm_medium=paid_social&utm_campaign=sa-auto-match-poc&utm_content=inventory
```

## Copy to paste

### Trade-in — primary — $20/day

**Primary text**

> Thinking about upgrading? Start with what you already own. Tell us what you're driving and what you want next, and we'll help organize your vehicle request. Start online, then request a visit when you're ready.

**Headline:** Start Your Vehicle Request Online

**Description:** Share your trade details and request a visit.

### SUV utility — $15/day

**Primary text**

> Need an SUV for everyday driving? Tell us what matters most — room, features, or a trade-in — and we'll help organize your vehicle request. Start online and request a visit when you're ready.

**Headline:** Start Your SUV Request

**Description:** Start your local SUV request online.

### Current inventory — $15/day

**Primary text**

> Looking for a new SUV near San Antonio? Tell us what you're looking for and we'll organize your vehicle request before a specialist confirms availability. Request a visit when you find a fit.

**Headline:** Request Current SUV Details

**Description:** Request current vehicle details before visiting.

## Before publishing — hard stop checklist

1. Confirm the neutral production domain and SSL.
2. Set Vercel production environment variables from `.env.example`; never put service keys in browser code or ad copy.
3. Confirm `CLICKUP_LIST_ID=901114100607` and ClickUp statuses: `NEW`, `CONTACTED`, `APPT SET`, `SHOWED`, `SOLD`, `LOST`.
4. Confirm the salesperson has ClickUp mobile notifications enabled and accepts the five-minute SLA.
5. Confirm the Meta Pixel ID is set in Vercel and verify `PageView` plus `Lead` in Meta Test Events.
6. Submit one internal fake lead on the production domain with UTM parameters.
7. Verify the Supabase row, ClickUp task, phone notification, optional email, and `/thanks` redirect.
8. Delete or mark the internal test lead `LOST`.
9. Confirm dealer approval of every ad and landing page before activating spend.

## First 72 hours

- Do not edit ads while they are in review.
- Watch spend, CPL, contact rate, appointment-set rate, show rate, and sold count.
- Pause an ad set after $25 with zero leads, or after $40 with CPL above $40.
- If the campaign has $150 spend and zero appointments, stop spend and fix follow-up or offer positioning before scaling.
- Scale only when appointment-set and show rates support it; do not optimize on cheap leads alone.

## Current blockers outside this repo

Meta campaign publishing requires an authenticated Business Manager with campaign permissions. Production deployment requires an authorized Vercel project/team and production environment variables. Those actions cannot be truthfully marked complete from source code alone.
