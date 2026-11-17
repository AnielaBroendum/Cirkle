# Portals v2: Brand and Retail portals

Old frames: Brand Portal (`3:3`), Retail Portal (`7:14`). New frame: "Portals v2 · Dynamic (draft)" (`358:151`). File `8eKYDZ98E49demFAx7Tjt7`, read 17 November 2026.

The portals move from the light theme to the dark v2 theme of the consumer app, with a new sidebar and top bar. Several screens show new numbers. Only the Brand and Retail portals are in scope, plus the shared login page (restyled for every role, decided 17 Nov). The branch rules were removed from `CLAUDE.md` when the work was finished; the portal layout is documented there under "Portals".

**Legend**
- **EXISTS**: already in the app, only needs restyling.
- **QUERY**: the data exists but needs a new read-only query (SQL function, as in migration 009).
- **MISSING**: needs new data, columns, tables or logic. Not built without asking.

## Screen checklist

| # | Figma screen | Node | Route | Part | Done |
|---|---|---|---|---|---|
| B01 | Brand Portal v2 / 01 Login | `368:480` | `/auth/login` (shared by every role) | B | [x] |
| B02 | Brand Portal v2 / 02 Dashboard | `358:161` | `/brand/dashboard` | C1 | [x] |
| B03 | Brand Portal v2 / 03 Product library | `364:238` | `/brand/products` | C2 | [x] |
| B04 | Brand Portal v2 / 04 Edit product | `364:587` | `/brand/products/[id]/edit` (and `/brand/products/new`) | C3 | [x] |
| B05 | Brand Portal v2 / 05 Stores and QR tags | `365:318` | `/brand/samples` (sub-tabs: requests, swaps, transactions, `/brand/partnerships`) | C4 | [x] |
| B06 | Brand Portal v2 / 06 Orders | `365:645` | `/brand/orders` | C5 | [x] |
| B07 | Brand Portal v2 / 07 Returns | `367:400` | `/brand/returns` | C6 | [x] |
| B08 | Brand Portal v2 / 08 Account and payouts | `367:651` | `/brand/account` | C7 | [x] |
| R01 | Retail Portal v2 / 01 Login | `368:518` | `/auth/login` (same page as B01) | B | [x] |
| R02 | Retail Portal v2 / 02 Dashboard | `359:204` | `/retailer/dashboard` | D1 | [x] |
| R03 | Retail Portal v2 / 03 Products in the store | `368:558` | `/retailer/samples` | D2 | [x] |
| R04 | Retail Portal v2 / 04 Store profile and payouts | `368:822` | `/retailer/profile` | D3 | [x] |

Not in Figma v2, kept as they are (restyled to dark only): `/brand/onboarding`, `/brand/products/new`, `/brand/samples/new`, `/brand/samples/requests`, `/brand/samples/swaps`, `/brand/samples/transactions`, `/brand/partnerships`, `/retailer/onboarding`, `/retailer/samples/request`, `/retailer/samples/transactions`, `/retailer/brands`.

## Final check (17 Nov 2026)

- All 12 screens done. The sub-pages outside Figma (requests, swaps, deposits, partnerships, Add sample, retail Brands / Request samples / Transactions, both onboardings) now use the dark tokens and `PageHeader` directly instead of light token names flipped by `portal-dark`; their cards use `Card tone="portal"`. `SidebarNav` was removed (`/ds-preview` shows `PortalSidebar`).
- Type check, lint and `npm run build` pass.
- End to end on the QA accounts: brand dashboard, edit product (saved, then reverted), print tag (logged), ship order #30 with GLS + tracking (status, `shipped_at`, timeline event written), approve return R-BF48 (#33); store dashboard, print tag (logged), store profile save (reverted).
- RLS: the new functions 016–025 return nothing for another brand's or store's ids, and nothing to anonymous callers. Found a pre-existing hole outside this work: the 001 policy "Public can read by invitation token" lets anyone read every partnership row that has an `invitation_token` (commission rates and the token), and the 002 accept policy lets any store update any open invitation to point at itself. Not changed (RLS change, needs a decision).
- Still MISSING (unchanged, need data or a decision): see Part C and the per-screen tables (Export settlement / CSV, webshop import, product SKU, Resend invite, friend's handle and Chain ID, return label, automatic store-cut reversal, Verified badge, Brand agreement, Keep me logged in, Forgot password, retail "+ Add products").

## Part D status (17 Nov 2026)

Retail screens R02–R04 rebuilt to v2 (D1–D3, one commit each). New read-only functions 023–025, applied to production 17 Nov.

## Part C status (17 Nov 2026)

Brand screens B02–B08 are rebuilt to v2 (C1–C7, one commit each). New read-only functions 017–022, applied to production 17 Nov. Every new number was checked against a manual SQL count on QA Atelier, and each screen was checked at 1440 and 768 px. Retail screens: see Part D status.

Still MISSING on the brand screens (not built, need data or a decision): Export settlement / CSV export, webshop import (line, re-run, Edited tab, Source column), product SKU, Resend invite, friend's handle and Chain ID on orders, a return label for the customer, automatic store-cut reversal on returns, Verified badge, Brand agreement.

## Part B status (17 Nov 2026)

Done: the shell (sidebar, top bar, ⌘K search, bell, Next payout) on every brand and retail page, the dark theme for both portals, and the login page. (At the time, screen bodies B02–B08 and R02–R04 still had their old layout; they were rebuilt in Parts C and D.)

- **Dark theme:** `portal-dark` on the portal root swaps the light tokens for dark ones (see "Portal dark theme" in `CLAUDE.md`). Nothing outside the portals changes; checked on `/`, `/auth/signup`.
- **Shell data:** `get_brand_portal_shell` and `get_retailer_portal_shell` (migration 016, applied to production 17 Nov). Migration 015 records the variant price override already in production.
- **Shell items marked MISSING and what was done:**
  - Search: searches the brand's products (name, category), partner stores (name, city) and orders (by number), or the store's products and brands. Results open the product, the store on Stores & tags (`?store=`), the order on Orders (`?order=`), Brands or Products.
  - Bell: brand = new orders, return requests, store requests and invitations still waiting; store = brand invitations, sample requests on their way, swap updates. Latest 10. Unread = newer than when the bell was last closed, remembered per browser (localStorage). No table.
  - Next payout (brand): estimate = sales via Flaym since the last payout day minus the store cut, without cancelled orders and returned items. Bar and "days left" come from `PAYOUT_DAY_OF_MONTH` (monthly), so they are shown. Labelled "estimate".
  - Next payout (store): every credited cut not paid out yet; the bar is the Ready share; caption = amount still in the return period.
- **Differences from Figma:** small meta text is Smoke, not Char (Char is never text); amounts use the app's "1.071 kr" format, rounded to whole kroner, not "DKK 1.071"; Stores & tags count = active partnerships; Retail nav keeps Transactions and Brands; the login has no "Keep me logged in" or "Forgot password", and its panel tag says "Flaym" because one page serves every role.
- **Old light tokens:** `canvas-warm` and `cinder` are now only used by `/ds-preview` (and old portal pages, where they read dark). `canvas`, `surface`, `line`, `slate` and light `primary` text are still used by landing, signup, invite, error, 404, print and the root `<body>`. Nothing removed. `SidebarNav` is unused.

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

**Done (17 Nov, C1).** Numbers: `get_brand_dashboard` (009) for scans, saves, purchases, sales, store cut, orders waiting and top stores; `get_brand_overview` (017) for Where things stand, saves by size (with the range before it) and the buy rate. Checked against manual SQL counts on QA Atelier.
- Filter row (Day/Week/Month/Year, product, store, size) sits under the greeting, as decided. Every block follows product, store and size. Where things stand is live (no period); Saves by size has its own 7 days / 4 weeks / 6 months switch (the brief says 4 weeks; Figma says 8 weeks).
- Insight line: the size whose saves changed most against the range before (at least 3 saves across both), plus the most saved size. Text is built from those two facts only.
- "Your payout" = sales − store cut for the filtered period (same estimate as the sidebar). "N orders to ship today" = orders still pending.
- Export settlement left out (MISSING). Top stores show a gradient square: stores have no logo field shown here.
- Shared v2 pieces in `src/components/ds/portal-ui.tsx`: `PageHeader`, `Panel`, `PanelHeader`, `Segmented`, `MetricTile`, `ScanBar`, `ArrowLink`, `Chip`, `Thumb`.

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

**Done (17 Nov, C2).** Numbers from `get_brand_product_stats` (018), checked against manual SQL on QA Atelier.
- Tiles: Products (placed in stores = products with an active sample), Scans this month with % vs. last month (calendar months, Copenhagen), Most scanned this month (scans · sold).
- Tabs All / In stores. Category filter (distinct `products.category`). Sort: Most scanned (default), Newest, Name, Price.
- The Scans column is **all time** (this month is nearly empty on most brands; the tile shows this month). In stores = dots + count of stores with an active sample.
- Search box dropped (⌘K searches products). Active switch and Delete moved to Edit product; inactive products get an "Inactive" tag. Deposit column dropped (still on Edit product).
- Left out, decided 17 Nov: import line, Re-run import, SKU, Edited tab, Source column (no data for any of them).

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

**Done (17 Nov, C3).** Same form for Add product. Save logic, variant stock and prices, and the image checks are unchanged.
- In stores (`get_product_store_scans`, 019): every store with an active partnership, scans of this product there (all time). Decided 17 Nov: switching a store **on** places the product there when you save, through the existing `POST /api/samples` (new active sample + QR tag); a store that already has it shows on and can't be switched off here (remove it on Stores & tags, so tags are never deleted by accident). No deposit transaction is written, same as the existing "Add sample" flow.
- Kept outside Figma: Stock and prices card, Sample deposit, and a Visibility card with the Active switch and Delete (moved from the product library).
- Left out: SKU and the "kept when the webshop is imported" line (no import).
- `Toggle` got a `portal` tone (square track, white knob); `light` and `dark` are unchanged.

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

**Done (17 Nov, C4).** Scan counts from `get_brand_store_scans` (020): all time, from events by the store on the tag, so they match Edit product → In stores. Checked against manual SQL.
- Store cards (most scanned first; `?store=` still selects one), pending invitations with "Copy invite link" (Resend invite is MISSING), store requests with "Review".
- Product list for the selected store: one row per product. Print tag and the bulk "Print N QR tags" re-print the existing code (oldest active sample, as `/api/tag-prints` resolves it). Products not in the store show "Not in store" and a "Place" link to Edit product; their scans are shown when the store scanned them before.
- Kept outside Figma: the sub-tabs, and Download QR / Open scan page / Delete per tag (Delete is how a piece leaves a store).
- Dropped: "Add sample" button (placing is on Edit product; `/brand/samples/new` still works), the QR image, deposit and swap badges, and the "Available stores" request form (it is on Partnerships).

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

**Done (17 Nov, C5).** Shipping works exactly as before: bulk "Mark as shipped" (`/api/orders/ship`), carrier + tracking + Mark as shipped / delivered (`/api/orders/[id]/status`, `/tracking`). Not clicked during the check (it ships real orders and sends emails).
- Tabs New / Shipped / Delivered / All; New also holds confirmed and packed orders (they still need shipping), so nothing is hidden. Opens on New.
- The chain (`get_brand_order_chain`, 021): Store → Passed on → Bought, first names only. For a sale passed on by a friend, the store is traced from the friend's own earlier purchase of the same product (read-only; "The store is where X bought it first"). Checked on QA order #11. A friend's handle (@ida.k) and the Chain ID are MISSING.
- Kept outside Figma: Confirm / Mark as packed / Cancel order as small buttons, and History (collapsed).
- `Modal` now takes the portal's dark theme when it opens inside a portal (it renders into `<body>`, outside `.portal-dark`). Nothing changes outside the portals.
- Left out: Export (no CSV).

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

**Done (17 Nov, C6).** Approve / Decline / Mark received / Mark refunded are unchanged (plain `returns` updates under RLS). Tiles from `get_brand_return_stats` (022), checked against manual SQL on QA Atelier.
- Waiting for you: requests in `requested`; "Approve within 3 days" with the oldest one's deadline (`RETURN_APPROVAL_DAYS = 3` in the page, display only, nothing is approved automatically).
- Return rate: requests made this month that weren't declined ÷ pieces sold this month (calendar months, Copenhagen), with last month for the hint.
- Refunded this month: refunds marked this month (by `updated_at`, which the trigger sets on each status change; there is no `refunded_at`), price × quantity.
- Top reason: all returns that weren't declined; Too big + Too small count together as Size.
- Tabs Open / Refunded / All. Return policy ↗ opens `return_policy_url` (hidden when empty).
- **Not in the app, so not built (told the user 17 Nov):** a return label for the customer, and an automatic reversal of the store's cut. The note says what does happen: the customer sends the piece back, the brand marks it received and refunded, and from approval on the item no longer counts towards the store's payout (013). The subtitle drops "Flaym refunds once you approve" for the same reason.

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

**Done (17 Nov, C7).** Save logic unchanged (`brand_profiles` + `brand_payout_details`).
- Brand card: name, webshop, return policy link, order emails (login email, read-only), plus About and Logo (kept: the consumer app uses them). Payouts: Reg. no., Account no. (shown as "•••• 1234" until focused), CVR.
- How a sale is split (decided 17 Nov): what checkout does, Your share 85% / Store's cut 15%, no Flaym fee segment. Checked in the database: every store-credited attribution is 15% (20 of 20), friend sales have no store cut. `STORE_CUT_PERCENT = 15` in the page mirrors the fixed rate in `src/app/api/checkout/route.ts`; change both together. The old "minus Flaym's fee" line is gone (there is no fee).
- Brand stories restyled to the v2 panel; upload checks, ordering and delete unchanged.
- Left out (decided 17 Nov): Verified badge. Brand agreement card (MISSING: no agreement record or document).

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

**Done (17 Nov, D1).** Numbers from `get_retailer_overview` (023), checked against manual SQL counts on QA Concept Store (scans 2 / 58 last month, saves 0 / 12, purchases credited 1 / 7, earned 82 kr all in the return period, earnings per month and per week, 0 missing tags).
- Tiles: this month so far vs. last month (calendar months, Copenhagen); the 7 bars are the last 7 weeks, this week in orange. Purchases credited = credited purchases (one per order) from the same rows as `get_retailer_payouts` (013), so cancelled orders and returned items don't count.
- Earned this month: store cut on purchases credited this month, split Ready to pay out / In return period by the 013 status. Paid out = latest `paid_out_at`, next = next payout date. The sidebar's Next payout is still every unpaid cut, so the two can differ.
- Earnings per Week / Month / Year: last 7 weeks, last 7 months or last 3 years, store cut by order date.
- Latest credited: 5 newest, "All" shows the rest in place (up to 50). The date note is a tooltip. Most scanned: top 3 this month (013).
- Print missing tags (decided 17 Nov): active tags in the store never printed (no `tag_prints` row), re-printed through `/print/tags`. Disabled when there are none.
- Left out: "+ Add products" (MISSING).

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

**Done (17 Nov, D2).** Numbers from `get_retailer_product_stats` (024), checked against manual SQL on QA Concept Store (QA Wool Overshirt: 242 scans, 18 buys).
- One card per product with an active sample in the store. Scans and buys are in this store, all time, from `events`, with the same rule as Most scanned (013): purchases on cancelled orders don't count; seeded purchase rows without an order do (12 of the 18 on QA), as on the brand screens.
- Price shows "From …" when the variants differ (015). Brand chips (All brands + each brand, by product count), Sort: Most scanned (default), Most bought, Name, Newest (when placed).
- Print tag re-prints every active tag of that product; Print all QR tags (PDF) every active tag in the store (browser print, as before). Not clicked during the check: it logs a print.
- Kept outside Figma (default): the Sample requests and Swap requests tabs ("Confirm received" and return tracking are there) and a small Swap button on the card. "Request samples" shows on the empty state.
- Dropped: status pills, deposit "held" badges, last-scan date, the QR image on the card (an icon instead).

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

**Done (17 Nov, D3).** Save logic unchanged (`retailer_profiles` + `retailer_payout_details`). Numbers from `get_retailer_profile_stats` (025), checked against manual SQL on QA Concept Store (earned 1.206 kr, 1 brand since Oct 2026, 100% of 2 scans this month).
- Earned since joining: store cut on every credited purchase, all payout statuses (cancelled and returned left out, as in 013). Since = first accepted active partnership.
- Brands in your store: active partners, products = distinct products with an active sample, share = the brand's scans in the store this month ÷ all scans in the store this month (scans of brands no longer partnered still count in the total, so shares can add up to less than 100%).
- Preview in app opens `/p/{sample_id}` of the store's oldest active sample in a new tab (hidden without one). Account no. shows "•••• 1234" until focused, as on brand Account.
- City, postal code, store type, description and logo aren't in Figma but are still saved, so they sit under "+ More details" (default).
- Left out (decided 17 Nov): the Verified badge (no verification state).

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
