# Pass-on chain

Scanned at (store) → Passed on by (giver) → Bought by (buyer), kept on every scan and purchase and shown to the brand and the people in the chain. Branch `pass-on-chain`. Migrations 026–030.

## Checklist

- [x] Findings reported and confirmed (where scans/attributions/events are written, commissions and payouts, pass-on link, giverless scans)
- [x] A: `026_scan_chain.sql` — origin/parent/chain columns on scans, BEFORE INSERT trigger, backfill, open insert policy dropped
- [x] A: Share button passes on `/d/{product}?ref={me}` (sign-in first); `/api/scans` takes the store from the tag only, skips self pass-ons
- [x] B: `027_attribution_chain.sql` — origin/chain on attributions, checkout fills them, backfill
- [x] B2: `028_peer_store_share.sql` — `platform_settings.peer_store_commission_bps` (0), store share on peer attributions, payouts and earnings
- [x] C: `029_brand_order_chain_v2.sql`, Orders detail chain, CSV export
- [x] D: `030_my_order_chain.sql`, buyer line, giver "Passed on" list
- [x] Dry run on production (rolled back): backfill counts, numbers unchanged
- [x] Scenario test on production (rolled back): store → 1 step → 2 steps, privacy, store share at 500 bps
- [ ] App flow in the browser against a database with 026–030 (not done: no test database with the migrations; see Testing)
- [x] Type check, lint, build
- [x] E: `031_brand_top_stores.sql` and Top stores on the brand dashboard (tested rolled back)
- [x] Applied 026–030 to production (22 Nov 2026); counts as in the dry run, setting 0, brand/buyer/giver functions answer on a real passed-on order

## Who gets what

| | Direct purchase (scanned the store's tag) | Passed-on purchase (scanned a friend's link) |
|---|---|---|
| Store | 15 % of the item price (`deferred`, `commission_amount_dkk`) | `peer_store_commission_bps` of the item price, **0 today** (`store_commission_amount_dkk`, "Passed on") — only the store where the chain started |
| Giver | — | 50 Flayms (only the friend whose link was scanned, not givers further up) |
| Buyer | 100 welcome Flayms on the first order (unchanged) | same |
| Brand | Item price minus the store's cut | Item price minus the store share (0 today) |

The base for both store amounts is the item price: before Flayms are used, without the 49 kr delivery fee. Rates are saved on each attribution when the order is placed.

## Changing the store share

One place: the `platform_settings` table (migration 028). In the Supabase SQL editor:

```sql
update public.platform_settings set peer_store_commission_bps = 500; -- 5 %; 0 = off
```

Checkout reads it for every new order (`src/lib/platform-settings.ts`). Old orders keep the rate they were placed with, and past orders get no share.

## Backfill (production dry run, rolled back)

| | Expected | Got |
|---|---|---|
| Peer scans traced (giver's earlier store scan found) | 9 | 9 |
| Peer scans unknown (no giver) | 21 | 21 |
| Peer orders traced | 4 | 4 |
| Peer orders unknown | 1 | 1 |
| Store scans with origin | | 32 of 32 (1 had a `source_retailer_id` different from its sample's store; origin uses the sample's store, `source_retailer_id` left as is) |
| Store attributions with origin | | 20 of 20 (8 with a chain id; 12 have no scan, origin from `source_retailer_id`) |

Before/after with the share at 0: store payouts, store shell, overview, product and profile stats, most scanned; brand shell, dashboard (30 days and all time), overview, store scans, product stats, product store scans; points balances, attributions, events and scan source columns: all identical. Differences: on the 4 traced peer orders `store_traced` goes from true to false (same store, now known from the chain instead of guessed), and one brand's `saves_by_size` comes back in a different row order (`get_brand_overview`, 017, has no ORDER BY there; the numbers are the same).

## Why some old peer scans have no giver

All 21 giverless peer scans are from 7–9 June 2026, before commit `136f2cb` started skipping in-app views of `/d/{product}` (no `?ref`). Those views were recorded as peer scans with nobody to credit. Nothing has written one since.

The live bug was the product page's Share button: it shared the page's own URL, so sharing from a store tag passed on the tag (the friend became a store scan, no giver), and re-sharing a friend's link passed on the friend's `ref` instead of your own.

## Top stores on the brand dashboard (Part E)

`get_brand_top_stores` (031) ranks stores by scans in the selected period: scans of the store's tags plus scans of QRs passed on from it. It counts scan events, like the rest of the dashboard (so seed events count too). A tag scan's store is `events.retailer_id`, and a passed-on scan's store is its scan's `origin_retailer_id`. The list shows one number per store; the "sold" chip is gone, since the brief asks for scans only. Nothing else changes: `events.retailer_id` and `source_retailer_id` stay as they are.

Tested on production in a rolled-back transaction, as the QA brand: QA Concept Store 625 → 628 all time (+3 passed-on scans), 3 → 4 this month (+1); Sonny Test and Kayak Bar unchanged. Every other dashboard number (KPIs, by-store cut, shell, overview) was identical before and after. Another brand doesn't see the QA store, and a shopper gets nothing.

## Scanning needs an account

A scan has to belong to a signed-in shopper, or the chain can't continue from them. The middleware sends signed-out visitors to `/p/*` and `/d/*` to `/auth/login?redirect=<the full link>&role=consumer`; "Create one" keeps the link, and after login, or sign-up plus the consent screen, they land back on the same page, `?ref=` included. `/api/scans` answers 401 without a session. Checked in the browser: signed out → login → back on a pass-on link, and the scan was saved with the shopper, its parent, origin store and chain.

Trade-off: people who scan but don't log in are no longer counted as scans in the brand and store stats.

## Testing

Before applying, both runs were on production inside one transaction that was always rolled back (nothing saved):

1. The dry run above.
2. A scenario with throwaway users: store, brand, a second brand, five shoppers. Shopper 1 scans the tag (sent with a wrong store id, which the trigger replaced) and buys; 1 passes on to 2; 2 passes on to 3 before buying; 3 buys, then 2 buys. Checked: every scan and attribution has the store as origin and one chain id; the brand chain shows Store → Ann → Bo → Cy with the right chain id, and the CSV function matches; shoppers 2 and 3 see their chain, 1 and 2 see "bought it" (1 also sees Cy via Bo); the other brand and an unrelated shopper get nothing; points 50 to each direct giver; store payout only the 15 % on the direct order. Then at 500 bps a fifth shopper bought from shopper 1's link: the store got a 25 kr "Passed on" row (5 % of 500 kr), the brand's store cut went up by the same, earlier orders didn't change; set back to 0.

Checkout in the scenario was done in SQL, following `src/app/api/checkout/route.ts` line by line, not through the route itself. Not done: the app flow and consumer screens in the browser, because the local app talks to production, which doesn't have the new functions. A free scratch project `cirkle-pass-on-test` (`dlfcwkhpufwcagwzuxze`) exists for this, but is empty. Its URL and anon key are in the gitignored `.env.scratch.local`; it needs its service_role key to be loaded.
