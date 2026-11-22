# Pass-on chain

Scanned at (store) → Passed on by (giver) → Bought by (buyer), kept on every scan and purchase and shown to the brand and the people in the chain. Branch `pass-on-chain`. Migrations 026–030.

## Checklist

- [x] Findings reported and confirmed (where scans/attributions/events are written, commissions and payouts, pass-on link, giverless scans)
- [x] A: `026_scan_chain.sql` — origin/parent/chain columns on scans, BEFORE INSERT trigger, backfill, open insert policy dropped
- [x] A: Share button passes on `/d/{product}?ref={me}` (sign-in first); `/api/scans` takes the store from the tag only, skips self pass-ons
- [x] B: `027_attribution_chain.sql` — origin/chain on attributions, checkout fills them, backfill
- [x] B2: `028_peer_store_share.sql` — `platform_settings.peer_store_commission_bps` (0), store share on peer attributions, payouts and earnings
- [ ] C: `029_brand_order_chain_v2.sql`, Orders detail chain, CSV export
- [ ] D: `030_my_order_chain.sql`, buyer line, giver "Passed on" list
- [ ] Test on the scratch project, dry run on production (rolled back), type check, lint, build

## Why some old peer scans have no giver

All 21 giverless peer scans are from 7–9 June 2026, before commit `136f2cb` started skipping in-app views of `/d/{product}` (no `?ref`). Those views were recorded as peer scans with nobody to credit. Nothing has written one since.

The live bug was the product page's Share button: it shared the page's own URL, so sharing from a store tag passed on the tag (the friend became a store scan, no giver), and re-sharing a friend's link passed on the friend's `ref` instead of your own.

## Testing

Tests run on a free scratch Supabase project, `cirkle-pass-on-test` (`dlfcwkhpufwcagwzuxze`), built from the repo migrations. Its keys are in the gitignored `.env.scratch.local`. Production is only touched by a dry run inside a transaction that is rolled back.
