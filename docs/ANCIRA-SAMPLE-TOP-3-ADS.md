# Ancira Sample Top-3 Mock Campaign

> Simulation only. These ads are not published or sent. The ranking uses three complete records extracted from South Park Nissan inventory page 1. It is not the final top three across all 295 vehicles.

## Ranking logic

The engine score combines:

- MSRP-minus-displayed-price value gap
- Displayed Ancira Savings relative to MSRP
- A small penalty when the price depends on a conditional customer-cash offer

It does not use financing, credit, monthly payment, approval, or demographic assumptions.

## Ranked sample

1. **2026 Nissan Kicks SV — stock N432803** — score 8.80
2. **2026 Nissan Kicks S — stock N397068** — score 7.17
3. **2026 Nissan Kicks S — stock S417017** — score 7.14

Scores are internal simulation values, not dealer claims.

## Ad 1 — Kicks SV

Landing page:

`https://sa-auto-match.vercel.app/ancira-deal/N432803?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-sample-n432803&utm_content=n432803`

Primary text:

> Looking for a compact SUV with a value-forward price? Take a closer look at this Nissan Kicks SV preview from South Park Nissan. Check the details online, then tell us what vehicle features matter to you so a specialist can confirm current availability.

Headlines:

- See This Nissan Kicks SV
- Compact SUV Match Near You
- Check This Vehicle Preview

## Ad 2 — Kicks S / S417017

Landing page:

`https://sa-auto-match.vercel.app/ancira-deal/S417017?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-sample-s417017&utm_content=s417017`

Primary text:

> A compact SUV can make everyday driving simple. Explore this Nissan Kicks S preview from South Park Nissan and tell us what you are shopping for. A vehicle specialist can verify current inventory and comparable options.

Headlines:

- Find Your Compact SUV Match
- See This Nissan Kicks
- Explore This Vehicle Preview

## Ad 3 — Kicks S / N397068

Landing page:

`https://sa-auto-match.vercel.app/ancira-deal/N397068?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-sample-n397068&utm_content=n397068`

Primary text:

> Want a practical SUV for daily life? Start with this Nissan Kicks S preview from South Park Nissan. Review the vehicle online, then request a match so a specialist can confirm the latest details and availability.

Headlines:

- Explore This Nissan Kicks S
- Compact SUV Options Near You
- Start With This Vehicle Match

## Landing-page guardrails

- Show the source date and inventory disclaimer.
- Show the displayed price as “Displayed Ancira Price,” not a guaranteed final price.
- Show conditional offers separately from the price.
- Show taxes, title, license, VIT tax, doc fee, and deputy fee disclaimers.
- Verify the VIN is still available before activating an ad.
- Pause the ad when the vehicle is sold, reserved, or materially repriced.

## Demographic matching approach

Do not manually infer sensitive demographics from the vehicle. For the simulation, use vehicle-specific creative signals and broad Meta delivery inside the approved geographic radius:

- Kicks SV: compact SUV, urban utility, features, daily driving
- Kicks S: practical SUV, easy online shopping, everyday use

Meta can optimize delivery based on engagement and lead outcomes without the campaign making unsupported demographic claims.
