# Claude Code Prompt for Building Cirkle MVP

Copy the prompt below into Claude Code to start building. Work through the phases in order — each one ends with something testable.

---

## Before you start

1. Create a Supabase project at https://supabase.com
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL + keys
3. Run `npm install` in the `cirkle/` folder
4. Run the SQL from `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor
5. Open Claude Code in the `cirkle/` folder

---

## Phase 1: Foundation + Auth (paste this first)

```
Read CLAUDE.md to understand the project. This is a three-sided marketplace called Cirkle. The project is already scaffolded with Next.js, Supabase, and Tailwind. The database schema is already deployed.

Build the auth system:

1. Create middleware.ts that checks Supabase auth on protected routes and redirects unauthenticated users to /auth/login. Public routes: /, /auth/*, /p/*, /d/*

2. Build /auth/signup page:
   - Role selection (brand / retailer / consumer) — can come from URL query param ?role=
   - Email + password + name fields
   - Calls supabase.auth.signUp with role in user_metadata
   - After signup, redirects to role-appropriate onboarding or dashboard

3. Build /auth/login page:
   - Email + password
   - After login, reads user's role from profiles table and redirects to /(brand)/dashboard, /(retailer)/dashboard, or /(consumer)/profile

4. Add a shared AuthProvider component that wraps the app and provides current user + profile via React context

5. Build role-based layout files:
   - src/app/(brand)/layout.tsx — sidebar nav with: Dashboard, Products, Samples, Partnerships, Orders
   - src/app/(retailer)/layout.tsx — sidebar nav with: Dashboard, Samples, Brands
   - src/app/(consumer)/layout.tsx — bottom tab nav (mobile-first) with: Home, Saved, Orders, Profile

All user-facing text should be in English. Code and comments in English. Use Tailwind + shadcn/ui patterns. Mobile-first responsive design.
```

---

## Phase 2: Brand Core (paste after Phase 1 works)

```
Read CLAUDE.md for context. Auth is working. Now build the brand experience.

1. Brand onboarding wizard at /(brand)/onboarding:
   - Step 1: Brand profile (name, description, logo upload to Supabase Storage, website)
   - Step 2: Upload first product (name, description, price in DKK, images, sizes, colors, materials text)
   - On completion, set onboarding_complete = true and redirect to dashboard
   - If brand visits any (brand) page without onboarding_complete, redirect to onboarding

2. Product management at /(brand)/products:
   - List view showing all products with image, name, price, stock status, active toggle
   - Add/edit product form with image upload (multiple images to Supabase Storage)
   - Product variant management: for each size × color combo, set stock count
   - Delete/deactivate products

3. Sample creation at /(brand)/samples:
   - List of all samples grouped by retailer
   - Create sample: select product + select retailer (from active partnerships) → generates unique QR code
   - QR code encodes: {NEXT_PUBLIC_QR_BASE_URL}/p/{sample_id}
   - Use the 'qrcode' npm package to generate QR as PNG, upload to Supabase Storage
   - Download QR as image button
   - Show sample status (active/inactive) and scan count

4. Brand dashboard at /(brand)/dashboard:
   - KPI cards: total scans (this week), total orders (pending), total revenue (this month), active samples count
   - Recent activity feed: latest scans and orders
   - Quick action: "You have X orders to fulfill" link

Prices are stored in øre (1 kr = 100 øre). Display as "X kr" using the formatDKK utility in lib/utils.ts.
```

---

## Phase 3: Retailer Invitation + Onboarding (paste after Phase 2 works)

```
Read CLAUDE.md for context. Brand product and sample management is working. Now build the retailer side.

1. Brand invites retailer at /(brand)/partnerships:
   - "Invite retailer" form: email address, proposed commission rates (default: 25% direct, 15% deferred, 10% tier-2)
   - Creates a brand_retailer_partnerships row with status 'invited' and a unique invitation_token
   - Sends invitation email via Resend (or just logs the invitation link for now if Resend isn't set up)
   - Invitation link: {APP_URL}/invite/{token}
   - List existing partnerships with status

2. Retailer invitation acceptance at /invite/[token]:
   - Public page (no auth required to view)
   - Shows: brand name + logo, proposed commission rates, "Join Cirkle as a retailer" CTA
   - If user isn't logged in: redirects to signup with role=retailer, then back to /invite/[token]
   - If user is logged in as retailer: accepts invitation, creates retailer_profile if needed, updates partnership to 'active'

3. Retailer onboarding at /(retailer)/onboarding:
   - Step 1: Store profile (name, description, address, city, postal code, store type dropdown, logo upload, store photos)
   - On completion, set onboarding_complete = true and redirect to dashboard

4. Retailer dashboard at /(retailer)/dashboard:
   - KPI cards: total scans (this week), sales attributed, commission earned (this month), active samples
   - Recent scans feed with product name + time
   - Active partnerships list

5. Retailer sample view at /(retailer)/samples:
   - Grid of all samples assigned to this retailer
   - Per sample: product image, product name, brand name, scan count, last scanned date
   - Status indicator (active/inactive)

6. Brand catalog at /(retailer)/brands:
   - List of all brands on the platform that the retailer doesn't have a partnership with yet
   - "Request partnership" button (creates a partnership with status 'invited' but from retailer side — brand must approve)
```

---

## Phase 4: Scan Flow + Consumer Purchase (paste after Phase 3 works)

```
Read CLAUDE.md for context. Brand and retailer sides are working. Now build the consumer scan-to-buy flow.

1. Public scan landing page at /p/[sampleId]:
   - No auth required to view
   - Looks up sample → product → brand → retailer
   - Shows: product images (carousel), brand name + description, product name, materials, available sizes, price
   - Attribution info: "Scanned at [retailer name]" if from retailer sample
   - Three CTAs: "Buy now" (requires auth), "Save for later" (requires auth), "Share" (share link)
   - Records a scan in the scans table with source_type='retailer' and source_retailer_id
   - If user is not logged in and clicks buy/save: redirect to /auth/signup?role=consumer&redirect=/p/[sampleId]
   - Mobile-first design — this is the first thing consumers see. Make it beautiful.

2. Peer discovery page at /d/[productId]?ref=[userId]:
   - Similar to /p/[sampleId] but attribution is peer-based
   - Shows: "Scanned via [peer name]" and "[peer name] gets 50 points if you buy"
   - Records scan with source_type='peer' and source_user_id from ref param

3. Mock checkout flow:
   - After user clicks "Buy now" and is authenticated:
   - Size/color selector if variants exist
   - Shipping address form (name, address, city, postal code)
   - Points redemption: show balance, let user choose how many to use (1 point = 1 kr discount)
   - Order summary showing: product, size, color, price, points discount, total
   - "Confirm order" button → creates order, order_items, order_event (status: pending)
   - Attribution: find the user's most recent scan for this product (within 90 days) and create an attribution record
   - If peer attribution: award 50 points to the peer via points_ledger
   - Award 100 welcome points on first purchase if user has no points yet
   - Confirmation page: "Your [product] is being packed at [brand]'s studio. Estimated delivery: 3-5 business days."

4. Consumer profile at /(consumer)/profile:
   - Points balance + history (earned/spent with reasons)
   - Account settings (name, email, address)

5. Consumer orders at /(consumer)/orders:
   - List of orders with status
   - Order detail page with Wolt-style visual timeline (from order_events)
   - Show tracking number/link when available

6. Saved products at /(consumer)/saved:
   - Grid of saved products with image, name, price, "days left" until attribution expires
   - "Buy now" button to go to checkout
   - Remove from saved
```

---

## Phase 5: Fulfillment + Order Management (paste after Phase 4 works)

```
Read CLAUDE.md for context. The full scan-to-buy flow works. Now build brand-side fulfillment.

1. Brand order management at /(brand)/orders:
   - List of orders sorted by status (pending first, then confirmed, packed, shipped)
   - Per order: order number, customer name, items with sizes/colors, shipping address, created date
   - Action buttons: "Confirm" → "Packed" → enter tracking number → "Shipped" → "Delivered"
   - Each status change creates an order_event and updates the order status
   - Each status change sends an email notification to the consumer (via Resend, or console.log if not configured)

2. Commission tracking visible in brand dashboard:
   - "Commission owed" section showing attributed sales with retailer name, amount, type (direct/deferred/tier2)
   - Total commission owed per retailer this month

3. Retailer commission view in retailer dashboard:
   - "Earned commission" section showing sales attributed to this retailer
   - Per sale: product, date, type (direct/deferred/tier2), amount
   - Monthly total

4. Peer discovery QR for delivered products:
   - When brand marks order as delivered, generate a peer discovery QR code
   - QR encodes: {APP_URL}/d/{product_id}?ref={consumer_user_id}
   - Show this QR in the consumer's order detail page: "Share your item — your friends can scan it and you earn points!"
   - Also make it downloadable/shareable

5. Email notifications (use Resend if API key is set, otherwise console.log):
   - Order confirmation to consumer
   - New order notification to brand
   - Order status updates to consumer
   - Retailer invitation email

6. PWA enhancements:
   - Service worker for offline caching of static assets
   - Install prompt component that shows on consumer pages
   - App-like navigation transitions
```

---

## Phase 6: Polish + Seed Data (paste last)

```
Read CLAUDE.md for context. All features are built. Now polish and add test data.

1. Create a seed script (src/lib/seed.ts or a Supabase SQL file) that creates:
   - 2 test brands (e.g., "STEM" and "A Kin") with 5 products each, including images (use placeholder URLs), variants, and stock
   - 3 test retailers (e.g., "Studio Nord", "Kaffebar Vesterbro", "Bloom & Blad") with profiles
   - Partnerships between brands and retailers with active status
   - 10 samples with QR codes distributed across retailers
   - 20 scans with mixed attribution (retailer and peer)
   - 5 orders in various statuses
   - Points ledger entries

2. Responsive polish:
   - Ensure all pages work well on mobile (375px width)
   - Scan landing pages (/p/ and /d/) should be especially polished — they're the first impression
   - Dashboard layouts should stack on mobile, side-by-side on desktop
   - Forms should be full-width on mobile

3. Loading states:
   - Add skeleton loaders for dashboard KPIs
   - Loading spinners for form submissions
   - Optimistic updates where appropriate

4. Error handling:
   - Proper error pages (404, 500)
   - Form validation with clear error messages in English
   - Toast notifications for success/error on actions

5. Empty states:
   - "No products yet" with CTA to add first product
   - "No orders yet" with explanation
   - "No scans yet" with tips for placement

Run the app and test the full flow: brand signup → upload product → create sample → invite retailer → retailer accepts → consumer scans QR → browses → buys → brand fulfills → consumer gets peer QR → share with friend.
```

---

## Phase 7: Sample Deposits & Swaps (paste after Phase 6)

```
Read CLAUDE.md for context. The app is working with all core features. Now add the sample deposit and swap system.

First, run the SQL from supabase/migrations/002_sample_deposits.sql in Supabase SQL Editor. This adds: sample_requests, sample_request_items, sample_transactions, swap_requests tables, plus deposit fields on samples and products.

1. Brand sets deposit amount per product:
   - Add a "Deposit amount (DKK)" field to the product create/edit form
   - This is what the retailer pays per sample of this product
   - Display it on the product card and in the brand's product list

2. Retailer requests samples at /(retailer)/samples/request:
   - Retailer browses products from their active brand partnerships
   - Selects products, picks size + color for each
   - Sees deposit amount per item and total deposit before submitting
   - Submits request → creates sample_request with sample_request_items
   - Brand gets notification of incoming request

3. Brand reviews sample requests at /(brand)/samples/requests:
   - List of incoming requests with status
   - Per request: retailer name, items requested, total deposit
   - "Approve" or "Reject" buttons (with optional note)
   - On approve: creates sample records (with deposit_amount_dkk and deposit_status='held'), creates sample_transaction records (type: deposit_paid), generates QR codes
   - Updates request status through: pending → approved → shipped (brand enters tracking) → received (retailer confirms)

4. Retailer requests sample swap at /(retailer)/samples:
   - On each active sample, add a "Swap" button
   - Swap flow: select which sample to return → pick replacement product/size/color → add reason (dropdown: "Not performing", "Wrong size", "Seasonal change", "Other") → submit
   - Creates swap_request record
   - Shows pending swaps in a "Swap requests" tab

5. Brand handles swap requests at /(brand)/samples/swaps:
   - List of swap requests with status
   - "Approve" button → retailer gets return shipping instructions
   - Retailer ships back → enters tracking number → brand receives
   - Brand inspects: "Condition OK" or "Damaged"
     - OK: refund old deposit (sample_transaction: deposit_refunded), ship new sample, charge new deposit (sample_transaction: deposit_paid)
     - Damaged: forfeit old deposit (sample_transaction: deposit_forfeited), ship new sample, charge new deposit
   - Status flow: requested → approved → return_shipped → return_received → inspected_ok/inspected_damaged → new_shipped → completed

6. Deposit dashboard widgets:
   - Retailer dashboard: "Deposit capital" card showing total deposits held, number of active samples, and a breakdown by brand
   - Brand dashboard: "Deposits held" card showing total deposits from all retailers, with drill-down per retailer
   - Sample list should show deposit amount and status per sample

7. Transaction history:
   - Retailer: /(retailer)/samples/transactions — ledger showing all deposit payments, refunds, and forfeitures with dates and amounts
   - Brand: /(brand)/samples/transactions — same view from brand perspective

All amounts in øre, displayed as "X kr". All text in English.
```
