# DealIntel SA — Facebook launch campaign

## Campaign objective

Generate **10 dealer-confirmed test-drive appointments per week** from San Antonio shoppers. Optimize toward confirmed appointments as soon as the event volume supports it; use the `Lead` event only as the launch-stage proxy.

## Offer

**See today’s best-scored local cars, understand why each one stands out, and request an availability-confirmed test drive before making the trip.**

The promise is confidence without the listing marathon. Every promoted vehicle must show its Deal Score, asking price, estimated market value, comparison confidence, and reasons. Do not use fake countdowns, guaranteed-savings language, or claim the dealer has confirmed a vehicle before the dealer actually responds.

## Destination

Use the campaign route so attribution survives into the appointment request:

`https://deal-intel-sa.ndominguez.workers.dev/today?utm_source=facebook&utm_medium=paid_social&utm_campaign=sa_daily_shortlist&utm_content={{ad.name}}`

Vehicle retargeting should point to the exact listing route with the `listing` query parameter. The site captures UTM values and `fbclid` in session storage, carries them into the vehicle page, and saves `utm_source` and `utm_campaign` with the lead.

## Campaign structure

### 1. Prospecting — confidence without the hunt

- **Audience:** Adults 25–64 within 45 miles of San Antonio; broad placement and Advantage+ audience expansion.
- **Creative:** Time-saved control and local-confidence variant.
- **Optimization:** Landing-page view until the `Lead` event is stable, then optimize to `Lead`.
- **Budget share:** 55%.

### 2. Evidence-first consideration

- **Audience:** Site visitors, 50%+ video viewers, and engaged social visitors from the last 30 days; exclude submitted leads.
- **Creative:** Score-breakdown and price-versus-market proof.
- **Optimization:** `ViewContent`, then `Lead` when volume allows.
- **Budget share:** 25%.

### 3. Vehicle retargeting — know before you go

- **Audience:** People who opened a specific deal or started an availability request in the last 14 days; exclude submitted leads.
- **Creative:** Exact vehicle, current score, real price signal, and confirmation utility.
- **Optimization:** `Lead`.
- **Budget share:** 20%.

## Creative matrix

Run one control and two variants per ad set. Keep the audience and landing experience fixed while each creative gathers a directional sample.

| Route | Hook | Primary CTA | Best placement |
|---|---|---|---|
| Time saved — control | Skip the listing marathon | See today’s deals | Feed, Reels, Stories |
| Evidence first | A good deal should show its work | Compare scored cars | Feed, retargeting |
| Truthful urgency | Today’s shortlist changes with the market | Check today’s shortlist | Stories, warm audiences |
| Appointment utility | Check the car before making the trip | Request a test drive | Exact-vehicle retargeting |
| Local confidence | San Antonio deals, scored and explained | View scored deals | Local prospecting |

## Measurement

Track this chain by campaign, creative, vehicle, and score band:

`ad_click → shortlist_view → SelectDeal → ViewContent → StartAvailabilityRequest → Lead → dealer_confirmed → shopper_attended`

The frontend emits Meta-compatible `PageView`, `Search`, `ViewContent`, and `Lead` events when `META_PIXEL_ID` is configured. Custom events are `SelectDeal` and `StartAvailabilityRequest`. UTM source and campaign are stored with lead submissions. Dealer confirmation and attendance should be sent back through Conversions API after CRM event wiring is available.

## Launch checklist

- Add the public Meta Pixel ID to `META_PIXEL_ID` in `wrangler.jsonc` or the Cloudflare environment.
- Verify PageView, ViewContent, StartAvailabilityRequest, and Lead in Meta Events Manager test events.
- Use only current listing imagery and current scores in dynamic ads.
- Suppress estimated savings when confidence is below the approved threshold.
- Exclude salvage/rebuilt vehicles from promoted sets.
- Review price, availability, complaints, and lead-delivery failures daily during launch week.

