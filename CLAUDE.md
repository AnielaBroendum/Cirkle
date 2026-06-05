# Cirkle — MVP

## What is Cirkle?

A three-sided marketplace for fashion. Brands upload products and send physical samples to retailers. Retailers (stores, cafes, museums, flower shops — any physical space) display samples with QR codes. Consumers scan QR codes to discover products, browse, and buy. Brands fulfill from their own warehouse. Every sold product gets a peer-discovery QR so the buyer's friends can scan and buy too — creating a viral loop.

## Stack

- **Framework**: Next.js 14+ (App Router, TypeScript, server components)
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth**: Supabase Auth (email/password + Google + Apple Sign In)
- **Styling**: Tailwind CSS + shadcn/ui
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

### Mock Checkout
- No real payment processing
- Consumer clicks "Buy now" → order is created with status "pending"
- Brand sees order in their dashboard and can update status
- Order goes through: pending → confirmed → packed → shipped → delivered

## QR Code URLs

- **Retailer sample**: `https://cirkle.dk/p/{sample_id}` — resolves to product page with retailer attribution
- **Peer discovery**: `https://cirkle.dk/d/{product_id}?ref={owner_user_id}` — resolves to product page with peer attribution

## Database

See `supabase/migrations/001_initial_schema.sql` for the complete schema. Key tables:

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
    ui/                     — shadcn/ui components
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
- Error handling: always return proper HTTP status codes from API routes
- Use Supabase's `createServerClient` in server components and API routes
- Use Supabase's `createBrowserClient` in client components

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
- No returns flow in MVP
- No multi-user roles within accounts (just owner)
- DPP fields are placeholder only (materials text field, no structured EU compliance)
- Email notifications via Resend for: order confirmation, status updates, retailer invitations
- The consumer experience should feel like a PWA — installable, fast, mobile-optimized
