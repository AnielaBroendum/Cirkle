# Portals v2: Brand and Retail portals

Old frames: Brand Portal (`3:3`), Retail Portal (`7:14`). New frame: "Portals v2 · Dynamic (draft)" (`358:151`). File `8eKYDZ98E49demFAx7Tjt7`, read 17 November 2026.

The portals move from the light theme to the dark v2 theme of the consumer app, with a new sidebar and top bar. Several screens show new numbers. Only the Brand and Retail portals are in scope, plus the shared login page (restyled for every role, decided 17 Nov). Rules: "Portals v2 rules" in `CLAUDE.md`.

**Legend**
- **EXISTS**: already in the app, only needs restyling.
- **QUERY**: the data exists but needs a new read-only query (SQL function, as in migration 009).
- **MISSING**: needs new data, columns, tables or logic. Not built without asking.

## Screen checklist

| # | Figma screen | Node | Route | Part | Done |
|---|---|---|---|---|---|
| B01 | Brand Portal v2 / 01 Login | `368:480` | `/auth/login` (shared by every role) | B | [ ] |
| B02 | Brand Portal v2 / 02 Dashboard | `358:161` | `/brand/dashboard` | B (shell), later | [ ] |
| B03 | Brand Portal v2 / 03 Product library | `364:238` | `/brand/products` | later | [ ] |
| B04 | Brand Portal v2 / 04 Edit product | `364:587` | `/brand/products/[id]/edit` (and `/brand/products/new`) | later | [ ] |
| B05 | Brand Portal v2 / 05 Stores and QR tags | `365:318` | `/brand/samples` (sub-tabs: requests, swaps, transactions, `/brand/partnerships`) | later | [ ] |
| B06 | Brand Portal v2 / 06 Orders | `365:645` | `/brand/orders` | later | [ ] |
| B07 | Brand Portal v2 / 07 Returns | `367:400` | `/brand/returns` | later | [ ] |
| B08 | Brand Portal v2 / 08 Account and payouts | `367:651` | `/brand/account` | later | [ ] |
| R01 | Retail Portal v2 / 01 Login | `368:518` | `/auth/login` (same page as B01) | B | [ ] |
| R02 | Retail Portal v2 / 02 Dashboard | `359:204` | `/retailer/dashboard` | B (shell), later | [ ] |
| R03 | Retail Portal v2 / 03 Products in the store | `368:558` | `/retailer/samples` | later | [ ] |
| R04 | Retail Portal v2 / 04 Store profile and payouts | `368:822` | `/retailer/profile` | later | [ ] |

Not in Figma v2, kept as they are (restyled to dark only): `/brand/onboarding`, `/brand/products/new`, `/brand/samples/new`, `/brand/samples/requests`, `/brand/samples/swaps`, `/brand/samples/transactions`, `/brand/partnerships`, `/retailer/onboarding`, `/retailer/samples/request`, `/retailer/samples/transactions`, `/retailer/brands`.

## Shell (sidebar + top bar, every portal screen)

| Element | Brand | Retail | Mark | Source / note |
|---|---|---|---|---|
| Name tile (logo square, name, "Brand Portal"/"Retail Portal") | ✓ | ✓ | EXISTS | `brand_profiles.name`, `retailer_profiles.name` |
| Nav groups WORKSPACE / STORE, SETTINGS | ✓ | ✓ | EXISTS | Layout only |
| Nav: Dashboard, Products, Stores & tags, Orders, Returns, Account, Log out | ✓ | | EXISTS | Brand nav today. "Stores & QR tags" is renamed "Stores & tags" |
| Nav: Dashboard, Products, Store profile, Log out | | ✓ | EXISTS | v2 drops Transactions and Brands; **kept in the sidebar under STORE** (decided 17 Nov) |
| Count: Orders (3) | ✓ | | EXISTS | `get_brand_nav_counts` (010): pending/confirmed/packed |
| Count: Returns (1) | ✓ | | EXISTS | `get_brand_nav_counts`: requested/approved/received |
| Count: Products (18) | ✓ | | QUERY | Count of the brand's products |
| Count: Stores & tags (5) | ✓ | | QUERY | Stores with an accepted partnership |
| Count: Products (14) | | ✓ | QUERY | Distinct products with an active sample in the store |
| Next payout date ("1 Dec") | ✓ | ✓ | EXISTS | `nextPayoutDate()`, `PAYOUT_DAY_OF_MONTH = 1` (`src/lib/payouts.ts`) |
| Next payout amount "DKK 41.072" | ✓ | | QUERY | No brand payout exists. Shown as an estimate: sales via Flaym in the payout period minus the store cut, excluding cancelled orders and returned items. No Flaym fee (the app has none). Decided 17 Nov |
| Progress bar + "18 days left in the period" | ✓ | | QUERY | Period = previous payout day → next payout day, from `PAYOUT_DAY_OF_MONTH` |
| Next payout amount "DKK 4.180" | | ✓ | QUERY | Ready + in return period, same rules as `get_retailer_payouts` (013); summed in SQL |
| Progress bar + "DKK 1.240 still in return period" | | ✓ | QUERY | Bar = ready share of the amount; caption from the same function |
| Search "Search products, stores, orders" ⌘K | ✓ | | MISSING | Default: searches the brand's own products, stores and orders under RLS. Results link to the page |
| Search "Search products and brands" ⌘K | | ✓ | MISSING | Default: the store's products and brands under RLS |
| Date chip "Friday 13 November" | ✓ | ✓ | EXISTS | Today, Europe/Copenhagen |
| "+ New product" | ✓ | | EXISTS | `/brand/products/new` |
| Notifications bell + unread dot | ✓ | ✓ | MISSING | Default: dropdown of recent items from existing tables (brand: new orders, return requests, store requests/pending invites; store: brand invites, shipped sample requests, swap updates). Unread = newer than when the bell was last opened, remembered per browser. No notification table |
| Account chip (initials, name, "Brand admin"/"Store manager") | ✓ | ✓ | EXISTS | Name from the profile. The role label is copy (no multi-user roles) |

## B01 / R01 Login (`/auth/login`)

One page for brands, stores and shoppers. v2 has two variants (Brand Portal, Retail Portal); the restyle uses one generic variant for everyone, so the label can't say which portal.

| Element | Mark | Note |
|---|---|---|
| Split screen: gradient panel with logo, "FORWARD", "Fashion worth wanting. / Find it. Flaym it. Forward.", portal label, flaymforward.com | EXISTS | Copy and layout |
| "Log in" heading, intro text | EXISTS | Intro is generic, not "Your account was set up by Flaym" |
| Email, Password | EXISTS | Same `handleSubmit` |
| "Show" password | EXISTS | UI only |
| "Keep me logged in" | MISSING | Session length is an auth change. Left out |
| "Forgot password?" | MISSING | No reset flow. Left out |
| "Log in" flame button | EXISTS | |
| "Need help? hello@flaym.app" / "First time? Use the link in your invitation email." | EXISTS | Copy. The shared page also keeps the sign-up link for shoppers |

## B02 Brand dashboard (`/brand/dashboard`)

Today: `get_brand_dashboard` (009) with period Day/Week/Month/Year and product/store/size filters.

| Element | Mark | Source / note |
|---|---|---|
| Date, "Good morning, Stem" | EXISTS | Brand name. The greeting by time of day is UI |
| "1,284 scans this month, 63 pieces sold and 3 orders waiting to ship" | EXISTS | `kpis.scans`, `kpis.purchases`, `pending_orders` |
| "↓ Export settlement" | MISSING | No settlement statement or CSV exists |
| "+ New product" | EXISTS | Route |
| **Where things stand** (Products 18 / 12 live in stores; Stores 5 / 3 active; Orders 63 / 45 delivered; Returns 4 / 3 resolved), each split Done / Moving / Waiting | QUERY | Totals exist per table, but the Done/Moving/Waiting split needs a definition per row and one SQL function. Proposed: Products done = in a store, moving = has a sample request/shipping, waiting = not placed; Stores done = active partnership with samples, moving = active without samples, waiting = pending invite; Orders done = delivered, moving = confirmed/packed/shipped, waiting = pending; Returns done = refunded/rejected, moving = approved/received, waiting = requested |
| ↗ links per row | EXISTS | Routes |
| **Saves by size** bars XS–XL | EXISTS | `saves_by_size` |
| 7 days / 8 weeks / 6 months | QUERY | New fixed ranges on the same RPC, separate from the period filter |
| "M is up 24%" + advice line | QUERY | Needs saves per size for the previous range |
| **Sales via Flaym** DKK 48.320 | EXISTS | `kpis.sales` |
| Store cut DKK 7.248 | EXISTS | `kpis.store_cut` |
| Your payout DKK 41.072 | QUERY | Sales − store cut (same estimate as the sidebar) |
| "⚑ 3 orders to ship today" | EXISTS | `pending_orders` |
| **From scan to purchase**: Scanned 1,284 / Saved 412 / Bought 63, 4.9% buy rate donut | EXISTS | KPIs exist; the % is worked out in the browser today. Move to SQL: QUERY |
| Top stores: name, scans, sold | EXISTS | `by_store` (top 5; v2 shows 3) |

**Dropped from the old dashboard**
- **Filters:** product, store, size and Day/Week/Month/Year. **Kept** (default) as a compact filter row under the greeting; they must still apply to every block.
- ±% change vs. the previous period on Scans/Saves/Purchases tiles (data still returned: `prev_*`).
- "Activity over time" chart (`chart`).
- "Top products" table (`top_products`).
- "Commission" list with Direct/Deferred/Tier 2 badges (`commissions`).
- "Deposits held" per store and "N active samples" (`deposits`, `active_samples`).
- "Recent activity" feed (`recent`).
- Size-filter note on the funnel.

## B03 Product library (`/brand/products`)

| Element | Mark | Source / note |
|---|---|---|
| "Imported from stem.dk · last import 12 Oct 2026" | MISSING | No webshop import, no import log |
| "↻ Re-run import" | MISSING | Same |
| "+ Add product" | EXISTS | `/brand/products/new` |
| Products 18 / 12 placed in stores | EXISTS | Count + distinct stores per product from active samples |
| Scans this month 1,284, "+18% vs. last month" | QUERY | Brand scans this and last month |
| Most scanned: Wool Overshirt, 344 scans · 21 sold | QUERY | Like `top_products` for this month |
| Tabs All 18 / In stores 12 | EXISTS | Today: All / In stores / Inactive |
| Tab "Edited 3" | MISSING | No source/edited flag |
| Category ▾ | EXISTS | `products.category` (free text) |
| Sort: Most scanned ▾ | QUERY | Scans per product |
| Column Product: name + "ST-0142 · Sand" | MISSING (SKU) / EXISTS (colour) | No product SKU. `product_variants.sku` exists but is unused |
| Columns Category, Sizes (XS–XL), Price, In stores | EXISTS | |
| Column Source (Imported / Edited / Added by hand) | MISSING | No column |
| Column Scans | QUERY | Per product, all time or this month |

**Dropped:** search box, Deposit column, Active toggle, Edit/Delete actions (row click opens edit), Inactive tab.

## B04 Edit product (`/brand/products/[id]/edit`)

| Element | Mark | Source / note |
|---|---|---|
| Breadcrumb "Product library / Wool Overshirt" | EXISTS | |
| "Fields you edit here are kept when the webshop is imported again." | MISSING | No import |
| Cancel / Save changes | EXISTS | |
| Name, Category, Price, Sizes (+ Add), About, Materials and care | EXISTS | |
| SKU | MISSING | No product SKU column |
| Colour (single) | EXISTS | `products.colors[]` (first colour, or keep multiple) |
| Images 4 / 8, Main, + Add, rules line | EXISTS | `ProductImagesUpload`, `PRODUCT_IMAGE_RULES` |
| In stores: store name + scans per store | QUERY | Names exist; scans per store per product need a query |
| "Choose which stores show this piece" toggles, "Not placed" | MISSING | Placing a product in a store creates a sample (`/api/samples`); removing deletes one. Exists as an API, but a toggle here is a new flow. Ask before building |

**Dropped:** Sample deposit field, stock per size × colour table (still needed for sold-out sizes; ask before removing).

## B05 Stores & QR tags (`/brand/samples`)

| Element | Mark | Source / note |
|---|---|---|
| "+ Invite store" | EXISTS | Invite modal, `/api/partnerships/invite` |
| Store list: name, city, N products, N scans | EXISTS / QUERY | City, product count EXISTS; scans per store today come from summing in the browser: QUERY |
| "Selected" / ↗ | EXISTS | UI |
| Aarhus Concept: "Invited · waiting", Pending | EXISTS | Pending partnership |
| "Resend invite" | MISSING | Only "Copy invitation link" exists. Resending the email touches Resend |
| "Nørrebro Store · products", "9 products placed · tags are unique to product, brand and store" | EXISTS | |
| Select all | EXISTS | |
| "⎙ Print 9 QR tags (PDF)" | EXISTS | `/print/tags` (browser print, not a PDF file) |
| Rows: checkbox, product, SKU, sizes, Print tag, scans | EXISTS (SKU MISSING) | |
| "Not in store" row with "–" | EXISTS | Products not in the store (today with an "Add" link) |
| Hint "Missing or worn tag? Print it again…" | EXISTS | Copy; matches `/api/tag-prints` |

**Dropped:** "Add sample" button, the sub-tabs (Sample requests, Swaps, Deposits, Partnerships), deposit "held" badges, swap badges, QR image, Download QR, Open scan page, Delete sample, Available stores and commission inputs. The sub-pages stay reachable.

## B06 Orders (`/brand/orders`)

| Element | Mark | Source / note |
|---|---|---|
| "Paid to Flaym. You ship by hand and mark each step." | EXISTS | Copy |
| "↓ Export" | MISSING | No CSV export |
| Tabs New 3 / Shipped 5 / Delivered 41 / All | EXISTS | Today also "In progress" (confirmed/packed) |
| "1 selected", "Mark as shipped" (bulk) | EXISTS | `/api/orders/ship` |
| Columns Order, Date, Items, Credited store, Total, Status | EXISTS | |
| Detail: number, date, items, total, status | EXISTS | |
| SHIP TO name + address | EXISTS | |
| Items with size and price | EXISTS | |
| THE CHAIN: Store Nørrebro → Passed on @ida.k → Bought Freja | MISSING (partly EXISTS) | Today one level: store or "Passed on by a friend". The friend's handle and a store + friend chain aren't stored together |
| "Chain ID FLC-8F21-3A" | MISSING | No chain ID |
| Carrier, Tracking (optional), Mark as shipped | EXISTS | |
| "The customer sees each step in the Flaym app." | EXISTS | Copy |

**Dropped:** "In progress" tab, status history timeline, Confirm / Mark as packed / Mark as delivered / Cancel order buttons, Save tracking, the "Waiting" badge.

## B07 Returns (`/brand/returns`)

| Element | Mark | Source / note |
|---|---|---|
| "Return policy ↗" | EXISTS | `brand_profiles.return_policy_url` |
| Waiting for you: 2 requests | EXISTS | Count of `requested` |
| "Approve within 3 days" | MISSING | Default: `RETURN_APPROVAL_DAYS = 3`, deadline shown only, no automatic approval |
| Return rate 4.8%, "Down from 6.1% last month" | QUERY | Returns ÷ items sold, this and last month |
| Refunded this month DKK 950, "1 return completed" | QUERY | Sum of refunded returns this month |
| Top reason: Size, "Too big or too small · 2 of 3" | QUERY | Reasons grouped (Too big + Too small = Size) |
| Tabs Open 2 / Refunded 1 / All | EXISTS | Today Open / All; Refunded is a filter |
| Columns Return, Order, Product + size, Reason, Requested, Refund | EXISTS | |
| Decline / Approve | EXISTS | |
| "Refunded" status | EXISTS | |
| Info: "…Flaym refunds them once the piece is back with you, and the store's cut is reversed automatically." | MISSING | The brand marks refunded by hand today, and returned items are only left out of the store's payouts (013); attributions aren't reversed. Copy must match what the app does |

**Dropped:** "Mark received" and "Mark refunded" steps (needed for the flow; keep in the row actions), customer comment.

## B08 Account and payouts (`/brand/account`)

| Element | Mark | Source / note |
|---|---|---|
| Save changes | EXISTS | |
| Brand name, Webshop, Return policy link | EXISTS | `brand_profiles` |
| Order emails go to | EXISTS | Read-only login email |
| Payouts: Reg. no., Account no. (masked), CVR | EXISTS | `brand_payout_details` (007) |
| "Paid monthly after settlement" | EXISTS | Copy |
| "Verified" badge | MISSING | No verification state |
| HOW A SALE IS SPLIT: Your share / Store's cut / Flaym fee | MISSING | No Flaym fee anywhere; store cut is per partnership (and checkout uses 15%) |
| Brand agreement: "Accepted 2 Sep 2026 by Sofie Lund", Accepted, View agreement ↗ | MISSING | No agreement record or document |
| Brand stories 3 / 10, upload, file requirements | EXISTS | `brand_stories` (012), `STORY_RULES` |

**Dropped:** About text and Logo upload (logo is still used by the consumer app; keep).

## R02 Retail dashboard (`/retailer/dashboard`)

Today: Week/Month/Year tabs, `get_retailer_payouts` and `get_retailer_most_scanned` (013).

| Element | Mark | Source / note |
|---|---|---|
| "Good morning, Nørrebro" | EXISTS | Store name |
| "712 scans in your store this month and 37 purchases credited to you." | EXISTS | Scans from `events`, purchases from payouts |
| "⎙ Print missing tags" | QUERY | "Missing" = active samples never printed. `tag_prints` is service-role only, so this needs a security definer function |
| "+ Add products" | MISSING | Left out (default). Suggestion: open the existing sample request flow `/retailer/samples/request` |
| Scans in store 712 +22% | EXISTS / QUERY | Count EXISTS; % vs last month QUERY |
| Saves 238 +11% | QUERY | Saves credited to the store aren't shown today |
| Purchases credited 37 +15% | EXISTS / QUERY | |
| Sparkline bars per tile | QUERY | Per-week counts |
| Earnings per month Apr–Oct, Week / Month / Year | QUERY | Store cut grouped by month (or week/year) |
| Earned this month DKK 4.180 | QUERY | Sums are done in the browser today; move to SQL |
| Ready to pay out DKK 2.940 / In return period DKK 1.240 | EXISTS (browser) → QUERY | Same |
| "Paid out 1 Nov · next 1 Dec" | EXISTS | Last `paid_out_at` + `nextPayoutDate()` |
| Latest credited: product, brand · amount, Return period / Ready / Paid out | EXISTS | `get_retailer_payouts` |
| "All" link | EXISTS | Needs a target (payouts list); today the dashboard shows 8 rows |
| Most scanned in your store: product · brand, scans, bar | EXISTS | `get_retailer_most_scanned` |

**Dropped:** "Active samples" tile, Recent scans, Active partnerships, Deposit capital (total and per brand).

## R03 Products in the store (`/retailer/samples`)

| Element | Mark | Source / note |
|---|---|---|
| Intro "Placed here by the brands…" | EXISTS | Copy |
| "⎙ Print all QR tags (PDF)" | EXISTS | `/print/tags?portal=retail` |
| Brand chips All brands 14 / Stem 9 / … | EXISTS | Brand filter (today shown only with more than one brand) |
| Sort: Most scanned ▾ | EXISTS | Scans per sample |
| Card: image, product, brand · price, scans | EXISTS | |
| "N buys" | QUERY | `get_retailer_most_scanned` has buys but is limited to top 5 and a period |
| Print tag | EXISTS | |

**Dropped:** "Request samples" button, tabs Sample requests / Swap requests, status pills, deposit "held" badges, last-scan date, Swap button and modal.

## R04 Store profile and payouts (`/retailer/profile`)

| Element | Mark | Source / note |
|---|---|---|
| Save changes | EXISTS | |
| "Preview in app ↗" | EXISTS | Default: opens `/p/{sample_id}` of one of the store's active samples in a new tab |
| Store name, Opening hours, Address | EXISTS | `retailer_profiles` |
| Cover image, "↑ Upload new" | EXISTS | First of `store_photos` |
| Payouts: Reg. no., Account no., CVR | EXISTS | `retailer_payout_details` |
| "Verified" | MISSING | No verification state |
| Earned since joining DKK 16.680, "From 3 brands · since Sep 2026" | QUERY | Sum of credited store cut, brand count, first partnership date |
| Brands in your store: name, N products, since | EXISTS | |
| Share of scans in your store this month (64% / 22% / 14%) | QUERY | Scans per brand ÷ all scans in the store |
| Brand logo tile | EXISTS | `brand_profiles.logo_url` |

**Dropped:** city, postal code, store type, description, logo upload, more than one photo.

## Open decisions and defaults

| Decision | Default |
|---|---|
| Brand dashboard filters | Keep product/store/size + period as a compact row under the greeting; every block uses them |
| Search ⌘K | The portal's own products, stores and orders (brand) or products and brands (store), under RLS; results link to the right page |
| Notifications bell | Dropdown of recent existing items with an unread dot; "read" is remembered per browser. No new table |
| Next payout box | Payout date from `PAYOUT_DAY_OF_MONTH`. Retail amount from the payout rules. Brand amount = sales − store cut estimate (decided 17 Nov). The period is monthly, so the bar and days left are shown |
| Approve within 3 days | `RETURN_APPROVAL_DAYS = 3`, deadline shown only |
| Retail "+ Add products" | Left out. Suggestion: link to `/retailer/samples/request` |
| Preview in app | Opens `/p/{sample_id}` for one of the store's samples in a new tab |
| Login | One v2 page for everyone (decided 17 Nov). Signup and invite keep the current panel |
| Retail Transactions and Brands | Kept in the sidebar (decided 17 Nov) |

## Proposed read-only SQL functions

Security definer, scoped to `auth.uid()`, like 009 and 013. New numbered migrations only.

- **Part B:** `get_brand_portal_shell(p_payout_day)` (nav counts + payout estimate and period), `get_retailer_portal_shell(p_payout_day)` (product count, unpaid amount, amount in return period).
- **Later parts:** brand where-things-stand splits, saves-by-size with previous range, product scans (this/last month, per product, per store), return stats (rate, refunded, top reason), retailer KPI deltas and earnings per month, missing tags, earned since joining, brand share of scans.

Before writing migration 015+: capture production's `add_variant_price_override` as its own migration (it is applied in production but not in the repo).
