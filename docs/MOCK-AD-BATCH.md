# SA Auto Match — Mock Ancira Deal Ad Batch

> **MOCK DATA ONLY.** The vehicles, prices, mileage, photos, scores, and availability in this document are fixtures for testing routing and creative. Do not publish them as real Ancira offers. Replace them with approved inventory-feed data before launch.

## Campaign setup

- Campaign: `ancira-mock-deals-test`
- Objective: Leads, or Conversions optimized for the `Lead` event after the pixel has volume
- Geo: 15–20 mile radius around the selected Ancira rooftop
- Budget for testing: $50/day total
- Use broad/Advantage+ delivery within the approved geo; let each vehicle's creative provide the strongest matching signal
- Destination URLs below are vehicle-specific landing pages

## Recommended creative/ad rows

| Rank | Vehicle fixture | Category | Score | Landing page | `utm_content` |
|---:|---|---|---:|---|---|
| 1 | 2024 Kia Seltos S | SUV | engine-ranked | `/deal/mock-ancira-seltos-003` | `mock-ancira-seltos-003` |
| 2 | 2023 Toyota Tacoma SR5 Double Cab | Truck | engine-ranked | `/deal/mock-ancira-tacoma-001` | `mock-ancira-tacoma-001` |
| 3 | 2023 Nissan Altima SV | Sedan | engine-ranked | `/deal/mock-ancira-altima-004` | `mock-ancira-altima-004` |
| 4 | 2022 Ford F-150 XLT SuperCrew | Truck | engine-ranked | `/deal/mock-ancira-f150-006` | `mock-ancira-f150-006` |
| 5 | 2022 Chevrolet Tahoe LT | SUV | engine-ranked | `/deal/mock-ancira-tahoe-002` | `mock-ancira-tahoe-002` |
| 6 | 2021 Toyota Sienna XLE | Van | engine-ranked | `/deal/mock-ancira-sienna-005` | `mock-ancira-sienna-005` |

The rank is calculated from the fixture's price movement, freshness, mileage signal, and condition. It is not a claim about a real Ancira deal.

## Ad 1 — Compact SUV

**URL**

`https://sa-auto-match.vercel.app/deal/mock-ancira-seltos-003?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=mock-ancira-seltos-003`

**Primary text**

> Looking for a practical SUV without the oversized footprint? This mock deal preview highlights a compact match with low miles and a value-forward price. Tell us what you want and a vehicle specialist can confirm current options near you.

**Headline options**

- Compact SUV Match Near You
- Find Your Next SUV Match
- See This SUV Deal Preview

**Suggested audience signal**

- Creative theme: first SUV, commuting, city-friendly utility
- Keep delivery broad within the geo; do not infer or target protected characteristics

## Ad 2 — Midsize Truck

**URL**

`https://sa-auto-match.vercel.app/deal/mock-ancira-tacoma-001?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=mock-ancira-tacoma-001`

**Primary text**

> Need a truck that works during the week and on the weekend? This mock Ancira deal preview features a popular midsize truck profile with practical mileage. Share what you drive and we will help confirm current truck matches nearby.

**Headline options**

- Find a Midsize Truck Match
- Truck Options Near San Antonio
- See This Truck Deal Preview

**Suggested audience signal**

- Creative theme: utility, weekend projects, midsize truck flexibility
- Broad/Advantage+ delivery within the approved geo

## Ad 3 — Sedan

**URL**

`https://sa-auto-match.vercel.app/deal/mock-ancira-altima-004?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=mock-ancira-altima-004`

**Primary text**

> A comfortable daily driver can still feel like an upgrade. This mock deal preview highlights a sedan with manageable mileage and a recent price movement. Tell us what matters to you and we will line up nearby vehicle matches.

**Headline options**

- Find a Sedan That Fits Your Life
- Daily-Driver Match Near You
- See This Sedan Deal Preview

**Suggested audience signal**

- Creative theme: commute, comfort, easy online shopping
- Broad/Advantage+ delivery within the approved geo

## Ad 4 — Full-Size Truck

**URL**

`https://sa-auto-match.vercel.app/deal/mock-ancira-f150-006?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=mock-ancira-f150-006`

**Primary text**

> Shopping for full-size capability? Start with a truck match built around the way you use your vehicle. This is a mock deal preview; submit a few details and a specialist can confirm what is actually available nearby.

**Headline options**

- Full-Size Truck Match
- Find Your Next Workhorse
- Truck Options Near You

**Suggested audience signal**

- Creative theme: capability, cargo, workday/weekend use
- Broad/Advantage+ delivery within the approved geo

## Ad 5 — Three-Row SUV

**URL**

`https://sa-auto-match.vercel.app/deal/mock-ancira-tahoe-002?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=mock-ancira-tahoe-002`

**Primary text**

> More room changes the way you travel. This mock deal preview highlights a three-row SUV profile for road trips, teams, and daily life. Tell us what space and features matter, and we will help confirm current matches.

**Headline options**

- Three-Row SUV Match
- More Room for the Road Ahead
- See This SUV Deal Preview

**Suggested audience signal**

- Creative theme: space, road trips, flexible seating
- Broad/Advantage+ delivery within the approved geo

## Ad 6 — Family Van

**URL**

`https://sa-auto-match.vercel.app/deal/mock-ancira-sienna-005?utm_source=meta&utm_medium=paid_social&utm_campaign=ancira-mock-deals&utm_content=mock-ancira-sienna-005`

**Primary text**

> Need flexible seating and room for real life? This mock deal preview focuses on a family-ready van profile. Share your vehicle needs and a specialist can confirm current inventory and comparable matches.

**Headline options**

- Family-Ready Vehicle Match
- Flexible Space Near You
- See This Van Deal Preview

**Suggested audience signal**

- Creative theme: flexible seating, family trips, cargo space
- Broad/Advantage+ delivery within the approved geo

## Data-to-live transition

When the Ancira feed is available:

1. Replace `lib/mock-inventory.ts` with the feed adapter while preserving `InventoryVehicle`.
2. Remove the `MOCK` labels and fixture disclaimer only after every field is verified.
3. Replace every mock image URL with approved inventory photo URLs.
4. Recalculate scores from live price, MSRP, price-change history, mileage, and days in inventory.
5. Regenerate this ad batch from the ranked live inventory.
6. Test every landing page against the live vehicle detail URL and availability.

## Compliance guardrails

Do not use credit, credit-score, financing, APR, approval, guaranteed-approval, or specific payment language in these ads or landing pages. Do not make “best deal” or price claims until they are supported by the approved live feed and verified against Ancira's current listing.
