# South Park Nissan Campaign Rollout Package

**Status:** Draft / internal review only  
**Inventory scope:** South Park Nissan only  
**Dealer group:** Ancira Auto Group  
**Market:** San Antonio, Texas  
**Inventory crawl:** 15 pages, 280 unique vehicles  
**Meta publishing:** Not performed from this environment

## Campaign structure

- Campaign name: `SA Auto Match — South Park Nissan — Rogue Top 3`
- Objective: Leads
- Budget: `$50/day` for the initial test
- Geo: Approved South Park Nissan service area
- Delivery: Advantage+ placements or mobile Feeds/Reels/Stories
- Audience: 21–35 tech-comfortable shoppers as the campaign hypothesis, subject to Meta’s current targeting rules
- Creative behavior: vehicle-specific, chat-first, fast details, appointment request
- No credit, financing, APR, approval, or payment claims

## Draft ads

| Rank | Vehicle | Stock | Destination |
|---:|---|---|---|
| 1 | 2026 Nissan Rogue S | N1862912 | `/ancira-deal/N1862912` |
| 2 | 2026 Nissan Rogue S | N862103 | `/ancira-deal/N862103` |
| 3 | 2026 Nissan Rogue SV | N806129 | `/ancira-deal/N806129` |

The visual review board is available at:

```text
/public/ancira-ad-preview.html
```

## Final pre-launch checks

- [ ] Confirm each VIN is still available
- [ ] Confirm displayed price and customer-cash eligibility
- [ ] Confirm dealer approval of the creative and landing copy
- [ ] Confirm the `$3,500` customer-cash language is conditional and correctly disclosed
- [ ] Confirm taxes, title, license, VIT tax, `$225` doc fee, and `$10` deputy fee treatment
- [ ] Confirm Meta Pixel `Lead` event in Events Manager
- [ ] Submit one internal fake lead on each landing route
- [ ] Verify Supabase row
- [ ] Verify ClickUp task
- [ ] Verify salesperson notification
- [ ] Confirm the 5-minute response process
- [ ] Only then publish the Meta campaign

## Chat-first customer experience

The ad and landing page should offer a quick path to:

1. See the vehicle summary.
2. Ask for current availability and exact price details.
3. Request comparable options.
4. Choose a preferred contact method.
5. Set an appointment.

The current app captures the lead and routes it to Supabase and ClickUp. A conversational bot appointment layer is still a separate integration; the current CTA is a structured lead form, not a live chat agent.

## Stop conditions

Pause a vehicle’s ad immediately if:

- The VIN is sold, reserved, or unavailable.
- The displayed price changes materially.
- The customer-cash offer is no longer valid.
- The source page disappears.
- The dealership cannot confirm the advertised details.

## Publishing limitation

The application and draft campaign assets are prepared locally. Meta Ads Manager publishing requires an authenticated Meta Business account and campaign permissions, which are not available in this session. Vercel publishing also remains blocked until the project-team authorization is corrected.
