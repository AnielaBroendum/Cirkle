# Figma update: gap analysis

Source: Figma file "Flaym Forward – MVP mockups (Phase 1)" (`8eKYDZ98E49demFAx7Tjt7`), updated October 2026. Branch: `figma-update`. The branch rules have been retired; the resulting schema, events and constants are documented in `CLAUDE.md`.

This update changes data and logic, not only layout. Each item below has two parts:
- **Today**: what the code and database do now.
- **Missing**: what Figma needs that isn't there.

Ticking an item means it's built and verified.

---

## Data and logic

### a) Events: scans, saves, purchases
- [x] **Scans** (into `events`, Part A)
  - **Today:** `scans` (`supabase/migrations/001_initial_schema.sql:138`) stores:
    - user: `scanner_user_id`, null when anonymous
    - product: `product_id`
    - QR tag and store: `sample_id`, `source_retailer_id`
    - giver: `source_user_id` with `source_type = 'peer'`
    - time and device: `scanned_at`, `user_agent`
    - `/api/scans` takes the user from the session. It is public, so signed-out scans are recorded.
  - **Missing:**
    - Anonymous scans are never linked to the account after signup.
    - The giver (`?ref=`) isn't checked against a real order or owned item.
    - Scans have no size (fine, since a scan happens before a size is chosen).
- [x] **Saves** (size + `events`, Part A)
  - **Today:** `saved_products` (001:234) stores `user_id`, `product_id`, `scan_id`, `saved_at` and `expires_at` (+90 days), with one row per user+product. `/api/saved-products` POST ties the save to the user's first scan of the product.
  - **Missing:**
    - No size, colour or variant.
    - Store and giver are only reachable through `scan_id → scans`, with no column of their own.
    - Removing a save hard-deletes the row, so no un-save history is kept.
- [x] **Purchases** (into `events`, Part A; commission rates still open)
  - **Today:** `orders.consumer_user_id`, `orders.created_at`. `order_items` has `product_id`, `product_variant_id`, `size`, `color`, `quantity` and `unit_price_dkk`. Store and giver are recorded in `attributions` (`source_retailer_id`, `source_user_id`, `scan_id`).
  - **Missing:**
    - Checkout (`src/app/api/checkout/route.ts`) always writes `deferred` at a hard-coded 15% and ignores the partnership's commission rates.
    - `direct` (25%) and `tier2` (10%) are never produced, which doesn't match CLAUDE.md → Commission Rates.
    - Quantity is always 1.

### b) Orders
- [ ] **Statuses**
  - **Today:** `order_status` = pending, confirmed, packed, shipped, delivered, cancelled. Transitions are in `src/app/api/orders/[orderId]/status/route.ts`.
  - **Missing:** a returned / partly-returned state, if Figma needs one.
- [x] **Timestamps** (`shipped_at`, `delivered_at`, Part C)
  - **Today:** `orders.created_at` and `updated_at`. Ship and delivery times can only be read from `order_events.created_at`.
  - **Missing:** `shipped_at` and `delivered_at` columns.
- [x] **Carrier and tracking** (Part C)
  - **Today:** `orders.tracking_number` and `tracking_url`, set on the move to `shipped`.
  - **Missing:** a carrier column.
- [x] **Return-period end date** (`orders.return_period_ends_at`, run 2 Part A)
  - **Today:** nothing.
  - **Missing:** a return deadline (e.g. delivered + N days), which the return rules and payouts depend on.
- [x] **Payout date** (`attributions.paid_out_at`, run 2 Part A; no payout job yet)
  - **Today:** `attributions.status` (`commission_status`: pending, confirmed, paid, reversed) exists, but no code moves it past `pending`. Bank details are in `retailer_payout_details` (004) and `brand_payout_details` (007).
  - **Missing:** a payout date / `paid_at`, any payout table or job, and the confirm-after-return-period step.

### c) Returns
- [ ] **Return requests**
  - **Today:**
    - Table `returns` (`supabase/migrations/003_returns.sql`): `order_id`, `order_item_id`, `user_id`, `reason` (too_big, too_small, not_as_expected, faulty), `comment`, `status` (requested → approved / rejected → received → refunded), timestamps, unique per order item.
    - RLS: the consumer reads and inserts their own (delivered orders only). The brand reads and updates returns on its orders.
    - `/api/returns` GET and POST. Brand UI: `/brand/returns`.
  - **Missing:**
    - No return-window limit (requests are allowed at any time after delivery).
    - No refund amount, return carrier/tracking or status timestamps.
    - A refund doesn't reverse the attribution, commission or points.
    - No returns emails.
    - `returns` is missing from `src/lib/database.types.ts`.

### d) QR tags
- [ ] **One code per product + brand + store**
  - **Today:** one `samples` row and one QR per physical sample. It encodes `{base}/p/{sample_id}`. There's no unique constraint on product + store, so one product can have several tags in a store.
  - **Missing:** a stable tag code per product + brand + store, if Figma means the tag rather than the sample. This decides whether swaps keep the same printed tag.
- [x] **Generation** (`src/lib/qr.ts`, Part D)
  - **Today:** the PNG (`qrcode`, 400px) is generated inline in three routes: `api/samples`, `api/sample-requests/[id]/approve` and `api/swap-requests/[id]/status`. It's stored at `brand-assets/qr-codes/{sample_id}.png`, with the URL in `samples.qr_code_url`.
  - **Missing:** a shared `src/lib/qr.ts` (CLAUDE.md lists it, but it doesn't exist).
- [x] **Printing** (Part D)
  - **Today:** two separate client-side `window.open` print grids, both with 3 columns:
    - Brand (`brand/samples/page.tsx`): 150px QR, product, size/colour, store.
    - Retailer (`retailer/samples/page.tsx`): 140px QR, product, brand, size/colour.
  - **Missing:** physical size in mm, Flaym logo, call to action, a short human-readable code, and one shared tag layout.

### e) Brand stories and product images
- [x] **Brand stories (Figma App 13)** (Part E; media only: the "[Story title]" in Figma 13 isn't stored yet)
  - **Today:** only `brand_profiles.description` (plain text, "About the brand" on `/brand/account`).
  - **Missing:** a story table (title, body, media, order, product links), storage for story media, and brand-portal editing.
- [x] **Product images** (Part E; removed images still stay in Storage)
  - **Today:** `products.images text[]` holds public URLs. Uploads go straight from the browser to the `brand-assets` bucket (`components/brand/image-upload.tsx`).
  - **Missing:**
    - The bucket and its policies are in no migration.
    - The only limit is a count: 5 product images, 1 logo, 5 store photos.
    - No file-size or type check beyond `accept="image/*"`, and no resizing.
    - Removed images stay in Storage.

### f) Consent
- [x] **"Share my data with brands" (Figma App 02)** (migration 014, run 2 Part B; both optional consents start off)
  - **Today:** nothing stores consent. `profiles` has no consent field and signup has no checkbox.
  - **Missing:** storage (recommended: a `consumer_consents` table with owner-only RLS and a timestamp per choice) and the consent screen.
  - **Decision needed:** Figma shows "Share my data with brands" **on** by default. Under GDPR, optional consents must start **off**.

### g) Push notifications
- [x] **Web push (Figma App 16, lock-screen notifications)** (Part C)
  - **Today:** none. `public/sw.js` only caches, and the service worker registers in production only. Notifications are Resend emails only (order confirmation, new order to the brand, status updates, invitations).
  - **Missing:** a `push` / `notificationclick` handler, VAPID keys, a `push_subscriptions` table (owner-only RLS), a `web-push` dependency, a permission prompt, and server-side sends on order status changes.

---

## Build parts (October 2026 run)

- [x] **A Event data** — `events` table (migration 008): type, user, product, size (save/purchase only), store, tag, giver, time; indexes on brand, product, store, size and time.
  - Written by `/api/scans`, `/api/saved-products` (Save now asks for a size) and `/api/checkout`. Save and checkout both credit the latest scan in the 90-day window (`src/lib/attribution.ts`), so store and giver carry through.
  - Backfill: all scans and purchases. Saves are backfilled without size (never stored). Not recoverable: un-saved items (hard-deleted) and anonymous scans never linked to an account.
  - Seed: `npm run db:seed-events` (`--reset` removes it), QA brand only, all rows marked `seed`.
- [x] **B Brand dashboard** — product / store / size / period filters, combinable, in the URL (`?period=&product=&store=&size=`), applied to every block.
  - All numbers come from `get_brand_dashboard` (migration 009) over `events`. Size filter: scans count every size, saves and purchases follow the size; a note under the funnel says so.
  - Funnel with saves/scans, purchases/saves, purchases/scans ("–" on divide by zero), and Saves by size under it.
  - Checked against hand-written SQL counts (all-year totals, size S saves, one store this month, product + store + size).
  - "Sales via Flaym" is now the item price of the filtered purchases (before points discounts), so it can follow the product and size filters.
- [x] **C Orders and menu counts** (migration 010)
  - Select orders and "Mark selected as shipped" (`/api/orders/ship`): each order gets its own `shipped_at`, timeline event, email and push. Shipping works straight from New.
  - "Waiting" badge on New orders older than `ORDER_WAITING_THRESHOLD_DAYS = 2` (`src/lib/orders.ts`).
  - Carrier (PostNord, GLS, DAO, Bring, Other) and optional tracking number per order, editable after shipping; known carriers get their tracking link automatically. The consumer tracking screen shows "With PostNord" and Figma 15's steps. "Out for delivery" has no data source yet (no carrier integration).
  - Web push: `web-push`, `push_subscriptions`, service-worker `push`/`notificationclick`, a "Turn on" prompt on the tracking screen (production builds only, as the service worker is). One message per step; Resend email is still always sent. Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
  - Sidebar counts: Orders = not shipped (New, confirmed, packed); Returns = requested, approved or received. Live via Realtime, after own actions and on tab focus.
- [x] **D Print tag** (migration 011)
  - "Print tag" per product and "Print N QR tags" in the brand portal (Stores & QR tags) and the retail portal (Products in the store) open `/print/tags`: 50 × 70 mm tags, nine per A4, dashed cut lines, Flaym logo, QR, "Scan to shop", product, brand, store.
  - Reprints the existing stored QR of the oldest active sample for that product + store. No new codes; QR generation now lives in `src/lib/qr.ts`.
  - `/api/tag-prints` only lets a brand print its own tags and a store its own store's tags (403 otherwise), and logs each tag in `tag_prints` (code, user, portal, time). No UI.
  - RLS: the "Public can read active samples" policy is gone. It let anyone read every store's samples and deposits; nothing used it.
- [x] **E Brand stories and product images** (migration 012)
  - Account → Brand stories: up to 10, fixed order (drag, or the arrows on touch/keyboard), shown on all the brand's products ("Brand stories ›" on the product page opens the Figma 13 viewer: images 6 s, videos their own length).
  - Edit product (and onboarding) → Images: up to 8, first is the main image, drag to reorder. New uploads go to the `product-images` bucket; existing `brand-assets` images keep working.
  - Rules are checked in the browser before upload and again on the server from the stored bytes (`src/lib/media-probe.ts`, `src/lib/media-rules.ts`), with messages like "Video is 26 s. Max is 20 s." The buckets also enforce size and file type. Files that fail the server check are deleted.
  - H.264: the browser's `<video>` can tell length and size but not the codec, so the codec is read from the MP4/MOV header instead (HEVC from iPhones is refused with a clear message).

---

## Build parts (second October 2026 run)

- [x] **A Retail payouts and most scanned** (migration 013)
  - Every purchase credited to a store has a status, derived from dates and never stored:
    - **Return period**: not delivered yet, the return period hasn't ended, or a return request is open.
    - **Ready**: the period has ended. It is paid on the next payout date (`PAYOUT_DAY_OF_MONTH = 1`).
    - **Paid out**: `attributions.paid_out_at` is set.
  - Cancelled orders and returned items (return approved, received or refunded) aren't credited.
  - `orders.return_period_ends_at` = delivered + `RETURN_PERIOD_DAYS = 14` (`src/lib/payouts.ts`). It is written on delivery, and existing delivered orders were backfilled with 14 days.
  - `attributions.paid_out_at` is new. Nothing sets it yet (no payout job). It can be set by hand or by the seed.
  - Retail dashboard → Latest credited purchases: totals per status (all-time), the latest 8 with a status pill and date note, and the Figma footnote with the next payout date. "Purchases credited" and "Earned" use the same credited set for the selected period.
  - Most scanned in your store: scans and buys per product for Week / Month / Year from `events` (`get_retailer_most_scanned`). Buys on cancelled orders don't count. "Scans in store" now counts the same events.
  - Both RPCs are security definer and only return the calling store's rows. A brand gets nothing back.
  - Seed: `npm run db:seed-events` also gives the QA store eight orders:
    - Return period ×5: shipped; delivered 3 days ago; open return; and two New orders.
    - Ready ×2.
    - Paid out ×1.
    - Not credited: one returned and one cancelled order.

    The RPC totals matched hand-written SQL (749.25 / 157.20 / 134.85 kr), and so did the screen.
- [x] **B Consumer app** (migration 014), checked at mobile width in the browser
  - Product page: one 04b layout for scan (`/p`), peer link and in-app (`/d` from Saved, History, Home).
    - Brand name is Ash, as in Figma (it was Smoke).
    - From Saved it shows "Saved at [store] · The store still gets its cut." and "Saved ✓", with the saved size picked.
    - `/d` no longer sends you Home when you never scanned the product. It shows the page with no "Found at" line instead of inventing one.
  - Sold-out sizes (`src/lib/stock.ts`):
    - A size is sold out when it has `product_variants` rows and all of them, for the chosen colour, are at 0 stock. Sizes without rows aren't tracked and stay available.
    - The chip has a dashed Char border, Smoke strikethrough, is disabled, and has "Sold out" next to it.
    - Checkout answers 409 for a sold-out size, and both checkout screens show that message.
    - Note: the brand form creates variants at stock 0, so 38 of 47 variants are sold out until brands enter stock. QA Overshirt S was set to 5 for the check; M stays 0.
  - Consent: `consumer_consents` is an append-only log (consent, granted, source, time) with owner-only RLS, insert and read only.
    - No row means off, so existing users stay off.
    - `/consumer/consent` (Figma 02, no tab bar): "Data for the chain" shows "Always on" and is logged as an acknowledgement. "Share my data with brands" and "News from brands" are switches that start off. "Start scanning" logs all three, then continues to `?redirect=` (for example back to the scanned product).
    - New shoppers go there after signup, and via the auth callback if they never answered.
    - Profile → "Privacy and data" has the same switches. Each change is a new row; the footnote shows when the choices last changed.
    - The ds `Toggle` has a `tone="dark"` for the app.
    - The consent isn't used to filter anything yet: brand dashboards only show counts.
  - Bottom menu: Scan / Flayms / Profile with the Figma icons, checked against Figma's tab bar. Discovery stays out of the menu.

---

## Design system (Part B)

Figma "Flaym / Colour" variables:

| Figma variable | Name | Hex | Use |
|---|---|---|---|
| text/primary | Flare | #FFFFFF | Primary text on dark |
| text/secondary | Ash | #D5D1C8 | Secondary text: brand names, descriptions |
| text/tertiary | Smoke | #ACA7A1 | Meta, labels, inactive tabs |
| line/char | Char | #7B7673 | Lines, borders, disabled. **Never text** |
| brand/flaym | Flaym | #FF5000 | Accent |
| surface/obsidian | Obsidian | #2C2324 | App background, dark text on light |
| light/text primary | Obsidian | #2C2324 | Portals: primary text |
| light/text secondary | Cinder | #4A3E3F | Portals: secondary text |
| light/text tertiary | Slate | #5E5856 | Portals: meta, labels, table headers |
| status/warning text | — | #8A5200 | Text on warning chips |

- [x] **B1 Colours**
  - Add the Figma colour tokens by name.
  - Keep the semantic tokens as aliases.
  - Retire `text-muted` (Char as text) in favour of Smoke (dark app) and Slate (light portals).
- [x] **B2 Type**
  - No text under 12px: `text-label` goes from 11px to 12px, and the three `text-[10px]` are removed.
  - Match the scale to the sizes Figma uses.
- [x] **B3 Buttons** with UPPERCASE labels (ds `Button` / `buttonClasses`).
- [x] **B4 Icons** in `src/components/ds/icons`:
  - App: Scan, Flayms, Profile.
  - Portal nav: Dashboard, Products, Stores & QR tags, Orders, Returns, Account, Store profile, Log out.
- [x] **B5 `/ds-preview`**: a development-only page showing tokens, type, components and icons.

Notes:
- Figma has **no published text styles**. The scale is taken from the sizes used in the frames. Publishing text styles in Figma would make future syncs exact.
- Portal frames also use a light divider, #EBE8E2. It isn't a Figma variable, so it isn't a token yet.
- Nav icons: the consumer tab bar and the brand/retailer sidebars use the Figma icons. Retailer Transactions and Brands keep lucide icons because the Figma Retail Portal nav has no icon for them.

---

## Final check (27 October 2026)

- End to end with the QA accounts, in the browser: scan `/p/{sample}` → save size S → buy (order #39) → brand ships with PostNord + tracking → consumer tracking shows "With PostNord", "On its way" and Track parcel → brand marks delivered → retail dashboard shows it under Return period ("ends 10 Nov"). With delivery moved back 15 days in the database, it moved to Ready ("Payout on 1 Nov"): Ready 157,20 → 239,55 kr, 2 → 3 purchases, the same as hand-written SQL.
- Brand dashboard against hand-written SQL over `events`: (1) this month + QA Wool Overshirt + size S: 138 scans, 26 saves, 7 purchases, 3.843 kr, and the per-store split; (2) this week + QA Concept Store: 17 / 4 / 4, 3.146 kr, and the per-product split. All equal.
- Fixed: the retail dashboard scrolled sideways at 1024 px (payouts table too wide for its column). The two columns now stack below 1280 px and long product names are truncated.
- Type check, lint and `npm run build`: no errors. The build prints a warning from inside supabase-js (Node API in the Edge middleware); it comes from the library, not this code.
- Still open: b) a returned order status, c) the return requests gaps, d) one stable tag per product + store; commission rates (`direct` / `tier2` never produced); a payout job for `paid_out_at`; story titles. Found during the check, older than this branch: stock is never decremented on purchase, and the 49 kr delivery fee shown at checkout isn't stored on the order.
