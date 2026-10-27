# Cirkle — MVP

## What is Cirkle?

A three-sided marketplace for fashion. Brands upload products and send physical samples to retailers. Retailers (stores, cafes, museums, flower shops — any physical space) display samples with QR codes. Consumers scan QR codes to discover products, browse, and buy. Brands fulfill from their own warehouse. Every sold product gets a peer-discovery QR so the buyer's friends can scan and buy too — creating a viral loop.

## Stack

- **Framework**: Next.js 14+ (App Router, TypeScript, server components)
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth**: Supabase Auth (email/password; Google and Apple Sign In are planned but not wired up)
- **Styling**: Tailwind CSS + the Flaym design system (`src/components/ds`)
- **QR Codes**: `qrcode` npm package
- **Email**: Resend (transactional emails)
- **Hosting**: Vercel
- **Mobile**: PWA (Progressive Web App) for consumer experience
- **Payments**: Mock checkout (no real payment processing in MVP — orders are created directly)

## Three User Roles

### Brand
Signs up → completes onboarding wizard (profile, product upload) → creates samples with QR codes → invites retailers → receives and fulfills orders from own warehouse → sees dashboard with scans/sales/commissions owed.

### Retailer
Receives email invitation from a brand → accepts → completes onboarding (store profile) → receives physical samples → displays them with QR tags → earns commission when scans lead to sales → sees dashboard.

### Consumer
Scans QR code (phone camera) → lands on public product page (no auth needed to browse) → creates account to buy → mock checkout → order confirmed → brand fulfills → consumer's product gets a peer-discovery QR → friends scan → consumer earns Cirkle Points.

## Key Mechanics

### Attribution
- Every scan is recorded with source info (which retailer's sample OR which peer's product)
- Last scan wins within a 90-day attribution window
- When a purchase happens, the system finds the most recent scan and attributes the sale

### Commission Rates
- Retailer direct sale (same session): 25%
- Retailer deferred sale (within 90 days): 15%
- Retailer tier-2 / brand discovery (different product, same brand, 90 days): 10%
- Peer discovery: 50 Cirkle Points to the peer (not monetary)
- **Not built yet:** checkout (`src/app/api/checkout/route.ts`) always writes `deferred` at 15% for store sales, whatever the partnership's rates. `direct` and `tier2` are never produced.

### Cirkle Points
- Consumers earn points when their friends scan their product's QR and buy
- 100 welcome points on account creation
- Points can be redeemed as a discount on purchases (1 point = 1 DKK as placeholder rate)
- Points balance = SUM(amount) from points_ledger table
- Points ledger is append-only (positive = earn, negative = spend)

### Sample Deposits & Swaps
- Retailers pay a deposit (set by brand per product) when they receive a sample
- Deposit is typically the brand's wholesale/cost price
- Samples can be swapped: retailer returns old sample, gets deposit back if undamaged, orders new sample with new deposit
- Financial tracking via sample_transactions ledger (deposit_paid, deposit_refunded, deposit_forfeited)
- Retailer dashboard shows total deposit capital tied up
- Brand dashboard shows total deposits held
- Swap flow: retailer requests swap → brand approves → retailer ships back → brand inspects → if OK, refund deposit + ship new sample → retailer pays new deposit

### Mock Checkout
- No real payment processing
- Consumer clicks "Buy now" → order is created with status "pending"
- Brand sees order in their dashboard and can update status
- Order goes through: pending → confirmed → packed → shipped → delivered (or cancelled). The brand can ship straight from pending, one order or several at once (`/api/orders/ship`)
- Shipping sets `orders.shipped_at`, `carrier` (PostNord, GLS, DAO, Bring, Other) and an optional tracking number; known carriers get their tracking link automatically. Delivery sets `delivered_at` and `return_period_ends_at`
- Every status change writes an `order_events` row (the consumer's tracking timeline) and sends a Resend email plus a web push, if the consumer turned push on
- A size is sold out when it has `product_variants` rows and all of them, for the chosen colour, have `stock_count` 0 (`src/lib/stock.ts`); checkout answers 409. Stock is never decremented on purchase
- The basket and checkout show a flat delivery fee (`DELIVERY_FEE_ORE`, 49 kr per brand) that isn't stored on the order: `orders.total_dkk` is the items only, and the order page says "Delivery: Free"

### Store payouts
Each purchase credited to a store has a payout status that is worked out from dates and never stored (`get_retailer_payouts`, `src/lib/payouts.ts`):
- **Return period**: not delivered yet, `return_period_ends_at` is still in the future, or a return request is open
- **Ready**: the return period has ended. It is paid out on the next payout date
- **Paid out**: `attributions.paid_out_at` is set. No job sets it yet: set it by hand or with the seed
- Cancelled orders and returned items (return approved, received or refunded) aren't credited

## QR Code URLs

- **Retailer sample**: `https://cirkle.dk/p/{sample_id}` — resolves to product page with retailer attribution
- **Peer discovery**: `https://cirkle.dk/d/{product_id}?ref={owner_user_id}` — resolves to product page with peer attribution

The host is not hardcoded: `src/lib/base-url.ts` uses `NEXT_PUBLIC_QR_BASE_URL`, then `NEXT_PUBLIC_APP_URL`, and falls back to the request's own origin when those point at localhost. Set both to the public domain in production, or printed tags and shared peer links will point somewhere friends can't reach. Sample tags are rendered to PNG when the sample is created, so they keep the host they were made with; peer QR codes are generated on demand.

## Database

The schema is the migrations in `supabase/migrations` (001–014), applied in order. Every database change goes in a new numbered file there. Key tables:

- `users` — extended via Supabase Auth, adds role + profile fields
- `brand_profiles` — brand-specific data (name, logo, description)
- `retailer_profiles` — store-specific data (name, address, photos)
- `products` — items brands sell (name, price, images, materials)
- `product_variants` — size/color combos with stock tracking
- `samples` — physical items in stores, each with unique QR
- `scans` — every QR scan event with attribution data
- `orders` — purchases with status tracking
- `order_items` — line items
- `order_events` — Wolt-style status timeline
- `attributions` — links orders to scans, tracks commission
- `points_ledger` — immutable earn/spend log
- `saved_products` — wishlist with 90-day attribution window
- `brand_retailer_partnerships` — contractual relationships with commission rates
- `sample_requests` — retailer requests to order samples from a brand
- `sample_request_items` — individual products/sizes within a sample request
- `sample_transactions` — financial ledger for deposit payments, refunds, and forfeitures
- `swap_requests` — retailer requests to swap underperforming samples for new ones
- `returns` (003) — one return request per order item: reason, comment, status requested → approved / rejected → received → refunded
- `events` (008) — one log of every scan, save and purchase (see Events below). The dashboards count from here
- `push_subscriptions` (010) — one web-push endpoint per browser/device, owner-only RLS
- `tag_prints` (011) — every printed QR tag: sample (the code), user, portal (`brand` / `retail`), time. Written by `/api/tag-prints`; no UI reads it yet
- `brand_stories` (012) — up to 10 story images/videos per brand, in a fixed `position` (1–10). Reorder with the `reorder_brand_stories` RPC
- `consumer_consents` (014) — append-only consent log: `consent` (`chain`, `share_with_brands`, `news_from_brands`), `granted`, `source` (`consent_screen`, `profile`), time. The latest row per consent wins; no row means off. `chain` is always on (logged as an acknowledgement). Owner-only RLS, insert and read only

Columns added during the Figma update:
- `saved_products.size` (008): the size chosen when saving
- `orders.carrier`, `shipped_at`, `delivered_at` (010); `orders.return_period_ends_at` (013): delivered + `RETURN_PERIOD_DAYS`, written on delivery so later changes don't move old deadlines
- `attributions.paid_out_at` (013): when the store's cut was paid out

Dashboard RPCs (security definer, only return the caller's own rows):
- `get_brand_dashboard` (009): every block on the brand dashboard, filtered by period, product, store and size
- `get_retailer_payouts`, `get_retailer_most_scanned` (013): the store's credited purchases with payout status, and scans/buys per product

Storage buckets: `brand-assets` (logos, store photos, QR PNGs at `qr-codes/{sample_id}.png`, older product images; not in any migration), `product-images` (10 MB, JPEG/PNG/WebP) and `brand-stories` (50 MB, MP4/MOV/JPEG/PNG), both from 012.

### Events
`events.type` is `scan`, `save` or `purchase`. Each row has the user (null for an anonymous scan), brand, product, size (save and purchase only; a scan never has one), store (`retailer_id`, from the scanned tag), tag (`sample_id`), giver (`giver_user_id`, from a peer link), the `scan_id` that carries store and giver, the order and order item (purchase only), quantity, unit price and `occurred_at`.
- Written with the service role (no insert policies) by `/api/scans`, `/api/saved-products` and `/api/checkout`, through `src/lib/events.ts`
- Save and checkout credit the user's latest scan of the product within the 90-day window, so store and giver carry through
- `origin` is `live`, `backfill` (rows made from existing scans/saves/orders in 008) or `seed`. `npm run db:seed-events` adds seed rows and QA orders for the QA brand and store; `npm run db:seed-events -- --reset` removes them
- Purchases on cancelled orders don't count on dashboards. With a size filter, scans still count every size, because people scan before picking one
- RLS: brands read their own events, stores read events from their store, users read their own
- Not to be confused with `order_events`, the per-order status timeline

### Config constants
- `ATTRIBUTION_WINDOW_DAYS = 90` (`src/lib/attribution.ts`)
- `RETURN_PERIOD_DAYS = 14` and `PAYOUT_DAY_OF_MONTH = 1` (`src/lib/payouts.ts`)
- `ORDER_WAITING_THRESHOLD_DAYS = 2` (`src/lib/orders.ts`): New orders older than this show "Waiting". `CARRIERS` and `VALID_TRANSITIONS` live there too
- `STORY_RULES` and `PRODUCT_IMAGE_RULES` (`src/lib/media-rules.ts`): stories max 10, video MP4/MOV H.264 ≤ 50 MB and ≤ 20 s, image JPEG/PNG ≤ 10 MB shown 6 s, all 1080 × 1920 (9:16); product images max 8, JPEG/PNG/WebP ≤ 10 MB, at least 1200 × 1600. Checked in the browser before upload and again on the server from the stored bytes
- `DELIVERY_FEE_ORE = 4900` (`src/components/consumer/basket-store.ts`): shown only, not charged (see Mock Checkout)

## File Structure

```
src/
  app/
    layout.tsx              — Root layout (fonts, metadata, providers)
    page.tsx                — Landing page (marketing / role selector)
    (auth)/                 — Login, signup, role selection
    (brand)/                — Brand dashboard, products, samples, partnerships, orders
    (retailer)/             — Retailer dashboard, samples, brands, invite acceptance
    (consumer)/             — Consumer profile, orders, saved products
    p/[sampleId]/           — Public scan landing page (retailer attribution)
    d/[productId]/          — Public peer discovery page (peer attribution)
    api/                    — API routes organized by domain
  lib/
    supabase.ts             — Browser client (supabase-server.ts, supabase-admin.ts, supabase-middleware.ts for the rest)
    database.types.ts       — Database types (`npm run db:types`)
    attribution.ts          — Attribution logic (latest scan in the window)
    events.ts               — Writes scan/save/purchase events
    orders.ts, order-updates.ts — Order rules, carriers, status changes with email + push
    payouts.ts              — Store payout status and dates
    stock.ts                — Sold-out sizes
    consents.ts             — Shopper consents
    media-rules.ts, media-probe.ts — Upload rules for stories and product images
    push.ts                 — Web push sends
    qr.ts                   — QR code generation (sample tags)
    base-url.ts, email.ts, utils.ts
  components/
    ds/                     — Flaym design system components (see Conventions)
    brand/                  — Brand-specific components
    retailer/               — Retailer-specific components
    consumer/               — Consumer-specific components
    shared/                 — Shared components (product card, status timeline, etc.)
```

## Conventions

- Use server components by default; add `'use client'` only when needed (interactivity, hooks)
- API routes use Next.js Route Handlers (`route.ts`)
- Use Supabase RLS (Row Level Security) for data access control
- All prices in DKK (stored as integers in øre, displayed as kr)
- UUIDs for all primary keys
- English language for all user-facing content and code/comments
- Mobile-first responsive design
- Tailwind for styling — no custom CSS files
- Build UI from the Flaym design system (below)
- Error handling: always return proper HTTP status codes from API routes
- Use Supabase's `createServerClient` in server components and API routes
- Use Supabase's `createBrowserClient` in client components

### Design system (Flaym)

The UI follows the Flaym Figma file. Use only these tokens (defined in `tailwind.config.ts`) and the components in `src/components/ds/`. Tailwind's default palette (`gray-*`, `red-*`, etc.) is not part of the design.

- **Colours** (Figma "Flaym / Colour" variables, by name): `flare` #FFF, `ash` #D5D1C8, `smoke` #ACA7A1, `char` #7B7673, `flaym` #FF5000, `obsidian` #2C2324, `cinder` #4A3E3F, `slate` #5E5856, `warning-text` #8A5200. Semantic aliases: `canvas` (white page), `canvas-dark` (Obsidian page), `canvas-warm` (off-white portal page), `surface`, `surface-muted`, `surface-dark` (card on a dark page), `primary` (Obsidian: text, primary buttons, nav), `on-primary`, `line` (Ash borders on light), `line-dark` (Cinder borders on dark), `accent` (Flaym orange: CTAs, active states), `accent-subtle`, `accent-strong`, `success`, `success-subtle`, `warning`, `warning-subtle`
- **Text levels**: dark app `text-flare` / `text-ash` / `text-smoke`; light portals `text-primary` (Obsidian) / `text-cinder` / `text-slate`. **Char is only for lines, borders and disabled states, never text** (`border-char`). There is no `muted` token any more.
- **No danger colour and no shadows**: Figma has neither. Errors use the accent tones (`text-accent-strong`, or an accent icon on `bg-primary`). Don't add red or box shadows.
- **Font**: `font-brand` (IBM Plex Mono 400/500/600) is the body default. Headings, labels and button labels are uppercase (`Button` does this itself).
- **Type scale** (nothing under 12px): `text-display` 36, `text-heading-xl` 32, `text-heading-lg` 20, `text-title` 18, `text-body-lg` 15, `text-body` 14, `text-body-sm` 13, `text-caption` 12, `text-label` 12 (uppercase, 0.7px), `text-button` 14 (uppercase, 0.8px). New size tokens must also be added to the `font-size` group in `src/components/ds/cn.ts`, or `cn` drops them next to a text colour.
- **Radius**: `rounded-control` (square, 0px) for buttons, inputs and cards; `rounded-pill` for pills, avatars and toggles
- **Gradients**: `bg-flaym-gradient` (welcome and auth art), `bg-flaym-scan` (consumer Scan screen)
- **Page backgrounds per area**: consumer app `bg-canvas-dark`; brand and retailer portals `bg-canvas-warm`; landing and auth `bg-flaym-gradient` with a `bg-canvas` form column; error and 404 `bg-canvas`
- **Components** (import from `@/components/ds`): `Logo`, `Button` / `buttonClasses`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`, `Card`, `CardHeader`, `Badge`, `StatusPill`, `Avatar`, `Modal` (sheet on mobile), `Tabs`, `TopBar`, `BottomNav`, `SidebarNav`, `EmptyState`, `StatTile`, skeletons (`Skeleton`, `KPISkeleton`, `ListSkeleton`, `CardSkeleton`), `Toast` / `ToastProvider` / `useToast` (mounted in the root layout), `List` / `ListRow`, `Table` (`THead`, `TBody`, `TR`, `TH`, `TD`), `ProductCard`, icons from Figma (`ScanIcon`, `FlaymsIcon`, `ProfileIcon`, `DashboardIcon`, `ProductsIcon`, `StoresQrIcon`, `OrdersIcon`, `ReturnsIcon`, `AccountIcon`, `StoreProfileIcon`, `LogOutIcon` in `ds/icons`), and `cn` for class merging. `/ds-preview` (development only) shows all of it.
- Shared layout pieces that aren't generic live next to their area, e.g. `components/shared/auth-shell.tsx` (login, signup, invite) and `components/consumer/checkout-parts.tsx`.

## Environment Variables

See `.env.example` for required variables. Key ones:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_QR_BASE_URL`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (web push; generate with `npx web-push generate-vapid-keys`)

## Important Notes

- No Stripe / no real payments — all purchases are mock
- No NFC — QR codes only
- No carrier integration — brand manually enters tracking numbers
- Returns: consumers request a return on a delivered order; the brand approves, marks it received, then refunded (`/brand/returns`, migration 003)
- No multi-user roles within accounts (just owner)
- DPP fields are placeholder only (materials text field, no structured EU compliance)
- Email notifications via Resend for: order confirmation, status updates, retailer invitations
- Web push on order status changes, only in production builds (the service worker registers in production only)
- The consumer experience should feel like a PWA — installable, fast, mobile-optimized
