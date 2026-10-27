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
- Order goes through: pending → confirmed → packed → shipped → delivered

## QR Code URLs

- **Retailer sample**: `https://cirkle.dk/p/{sample_id}` — resolves to product page with retailer attribution
- **Peer discovery**: `https://cirkle.dk/d/{product_id}?ref={owner_user_id}` — resolves to product page with peer attribution

The host is not hardcoded: `src/lib/base-url.ts` uses `NEXT_PUBLIC_QR_BASE_URL`, then `NEXT_PUBLIC_APP_URL`, and falls back to the request's own origin when those point at localhost. Set both to the public domain in production, or printed tags and shared peer links will point somewhere friends can't reach. Sample tags are rendered to PNG when the sample is created, so they keep the host they were made with; peer QR codes are generated on demand.

## Database

See `supabase/migrations/001_initial_schema.sql` and `002_sample_deposits.sql` for the complete schema. Key tables:

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
    supabase.ts             — Supabase client (browser + server)
    types.ts                — Database types (generate with `supabase gen types typescript`)
    attribution.ts          — Attribution logic
    points.ts               — Points calculation
    qr.ts                   — QR code generation
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

- **Colours**: `canvas` (white page), `canvas-dark` (Obsidian page), `canvas-warm` (off-white portal page), `surface`, `surface-muted`, `surface-dark` (card on a dark page), `primary` (Obsidian: text, primary buttons, nav), `on-primary`, `muted` (secondary text), `line`, `line-dark`, `accent` (Flaym orange: CTAs, active states), `accent-subtle`, `accent-strong`, `success`, `success-subtle`, `warning`, `warning-subtle`
- **No danger colour and no shadows**: Figma has neither. Errors use the accent tones (`text-accent-strong`, or an accent icon on `bg-primary`). Don't add red or box shadows.
- **Font**: `font-brand` (IBM Plex Mono 400/500) is the body default. Headings and labels are uppercase via `uppercase`.
- **Type scale**: `text-display`, `text-heading-xl`, `text-heading-lg`, `text-body`, `text-caption`, `text-label`
- **Radius**: `rounded-control` (square, 0px) for buttons, inputs and cards; `rounded-pill` for pills, avatars and toggles
- **Gradients**: `bg-flaym-gradient` (welcome and auth art), `bg-flaym-scan` (consumer Scan screen)
- **Page backgrounds per area**: consumer app `bg-canvas-dark`; brand and retailer portals `bg-canvas-warm`; landing and auth `bg-flaym-gradient` with a `bg-canvas` form column; error and 404 `bg-canvas`
- **Components** (import from `@/components/ds`): `Logo`, `Button` / `buttonClasses`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`, `Card`, `CardHeader`, `Badge`, `StatusPill`, `Avatar`, `Modal` (sheet on mobile), `Tabs`, `TopBar`, `BottomNav`, `SidebarNav`, `EmptyState`, `StatTile`, skeletons (`Skeleton`, `KPISkeleton`, `ListSkeleton`, `CardSkeleton`), `Toast` / `ToastProvider` / `useToast` (mounted in the root layout), `List` / `ListRow`, `Table` (`THead`, `TBody`, `TR`, `TH`, `TD`), `ProductCard`, and `cn` for class merging
- Shared layout pieces that aren't generic live next to their area, e.g. `components/shared/auth-shell.tsx` (login, signup, invite) and `components/consumer/checkout-parts.tsx`.

## Figma update rules

On the `figma-update` branch these rules replace the Redesign rules (the reskin-only rules behind `REDESIGN.md`). The work list is `FIGMA-UPDATE.md`.

- Data and logic changes ARE allowed, but only what the current task describes.
- Every database change goes in a new file in `supabase/migrations`. Never drop or rename columns/tables or delete data without asking first.
- Keep RLS: brands only see their own data, retailers only their own store's data.
- Existing flows (QR attribution, points, checkout, Resend emails, auth) must keep working.
- Use the design tokens and `src/components/ds` for all UI. Commit after each finished part.

## Environment Variables

See `.env.example` for required variables. Key ones:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`

## Important Notes

- No Stripe / no real payments — all purchases are mock
- No NFC — QR codes only
- No carrier integration — brand manually enters tracking numbers
- Returns: consumers request a return on a delivered order; the brand approves, marks it received, then refunded (`/brand/returns`, migration 003)
- No multi-user roles within accounts (just owner)
- DPP fields are placeholder only (materials text field, no structured EU compliance)
- Email notifications via Resend for: order confirmation, status updates, retailer invitations
- The consumer experience should feel like a PWA — installable, fast, mobile-optimized
