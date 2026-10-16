# Cirkle redesign: inventory

The new Figma UI is a reskin: functionality must not change. The rules are in `CLAUDE.md` → "Redesign rules".

Legend: **C** = client component, **S** = server component. "Reads" = direct Supabase table and RPC reads in the page (keep them). "Calls" = API routes the page hits (keep them).

---

## Shared / public

| Route | File | Type | What it does | Reads | Calls / integrations |
|---|---|---|---|---|---|
| (root layout) | `src/app/layout.tsx` | S | Fonts, metadata, `AuthProvider`, `ToastProvider`, service worker registration | — | PWA (`public/manifest.json`, `public/sw.js`) |
| `/` | `src/app/page.tsx` | S | Landing page and role selector. Links to `/auth/signup?role=…` and `/auth/login` | — | — |
| `/auth/login` | `src/app/auth/login/page.tsx` | C | Clears any stale session, signs in with email/password, then redirects by role (brand → `/brand/dashboard`, retailer → `/retailer/dashboard`, consumer → `/consumer/profile`, or the `?redirect=` target) | `profiles` | Supabase Auth `signOut`, `signInWithPassword` |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | C | Signs up with a role (honours `?role=` and `?redirect=`), then redirects by role | — | Supabase Auth `signOut`, `signUp` |
| `/auth/callback` | `src/app/auth/callback/route.ts` | route | OAuth / email-confirm code exchange. **Not UI. Don't touch.** | — | Supabase Auth |
| `/p/[sampleId]` | `src/app/p/[sampleId]/page.tsx` | S | Retailer QR landing page: loads the sample and product, then renders `ProductPageClient` with retailer attribution | `samples` (admin client) | via `ProductPageClient`: `/api/scans`, `/api/saved-products` |
| `/d/[productId]` | `src/app/d/[productId]/page.tsx` | S | Peer-discovery landing page (`?ref=owner`): loads the product, checks the user, records the peer scan. Logged-out users go to `/auth/login?redirect=…`; some cases redirect to `/consumer/home` | `products`, `profiles`, `scans` | `ProductPageClient` |
| `/invite/[token]` | `src/app/invite/[token]/page.tsx` | C | Retailer views a brand's invitation and accepts it, then goes to `/retailer/onboarding` | `brand_retailer_partnerships`, `brand_profiles` | `POST /api/partnerships/accept` |
| error | `src/app/error.tsx` | C | Global error boundary | — | — |
| 404 | `src/app/not-found.tsx` | S | Not-found page | — | — |

---

## Consumer portal: `src/app/(consumer)/` (redesigned to Figma "App", Oct 2026)

Layout `(consumer)/layout.tsx` (C): Figma tab bar (Scan, Flayms, Profile). Profile stays active on `/saved`, `/history`, `/qr`, `/orders`, `/owned`. The bar is hidden on checkout, basket and return screens. Also `InstallPrompt` and `PageTransition`.

| Route | Figma | What it does | Reads | Calls |
|---|---|---|---|---|
| `/consumer/home` | 03 | Scan tab: in-app camera (`jsqr`), opens Flaym `/p` or `/d` links only | — | — |
| `/consumer/flayms` | 08 | Passed on / Lit counts, latest feed, points balance and history | `points_ledger` | `GET /api/flayms` |
| `/consumer/profile` | 09b | Profile header + Owned grid; orders, QR codes, settings, sign out | `orders`, `profiles` | `GET /api/flayms` |
| `/consumer/saved` | 19 | Saved tab (90-day window), Buy, remove | `saved_products` | `DELETE /api/saved-products` |
| `/consumer/history` | 20 | History tab: first scan per product + unscanned saves | `scans`, `saved_products` | — |
| `/consumer/owned/[itemId]` | 18 | Owned item: passed on / lit, bought at, pass it on, return | `order_items`, `scans` | `GET /api/flayms` |
| `/consumer/qr` | 10b | `?order=&product=`: one Pass it on code; otherwise all codes | `orders` | `GET /api/orders/[id]/qr` |
| `/consumer/basket` | 05 | Client basket (localStorage), grouped by brand | — | — |
| `/consumer/checkout` | 06, 14 | Basket checkout: one `POST /api/checkout` per item, mock payment picker | RPC `get_points_balance` | `POST /api/checkout` |
| `/consumer/checkout/[productId]` | 06, 14 | Single-item checkout (unchanged logic, new look) | `products`, RPC `get_points_balance` | `POST /api/checkout` |
| `/consumer/orders` | 07 | Order cards with steps, Arriving estimate | `orders` (+ brand, events) | — |
| `/consumer/orders/[orderId]` | 15, 17 | Tracking timeline, or delivered hero + peer QR | `orders` | `GET /api/orders/[orderId]/qr` |
| `/consumer/orders/[orderId]/return` | 11 | Request a return for a delivered item | `orders` | `GET`/`POST /api/returns` |
| `/d/[productId]/about` (public) | 12 | DPP: real materials + description; marked placeholders | `products` | — |

Product page (used by `/p` and `/d`, Figma 04b/04c): `src/components/consumer/product-page-client.tsx`. It records the scan (`POST /api/scans`) and saves (`/api/saved-products`) as before; **Buy** now adds the chosen size/colour to the basket and opens `/consumer/basket`.

**New backend pieces (approved exceptions to the redesign rules):**
- `GET /api/flayms`: read-only; checks the user, then reads peer scans and peer attributions with the admin client; returns counts and first names only.
- `GET`/`POST /api/returns` + `supabase/migrations/003_returns.sql` (`returns` table, RLS). **The migration must be applied** (`supabase db push`) before returns work. No brand-side returns view or emails yet.
- Dependency: `jsqr` 1.4.0.

---

## Retailer portal: `src/app/(retailer)/` (redesigned to Figma "Retail Portal", Oct 2026)

Layout `(retailer)/layout.tsx` (C): dark ds `SidebarNav` (Dashboard, Products, Transactions, Brands, Store profile, Log out) on `bg-canvas-warm`. It reads `retailer_profiles` and redirects to `/retailer/onboarding` until the profile exists (unchanged). Figma has desktop frames only; mobile uses the SidebarNav drawer.

| Route | Figma | What it does | Reads | Calls |
|---|---|---|---|---|
| `/retailer/dashboard` | 02 | KPI tiles (scans this week, active samples, purchases credited, earned this month), latest credited purchases, recent scans, partnerships, deposit capital | `retailer_profiles`, `samples`, `scans`, `attributions`, `brand_retailer_partnerships`, `order_items`, `products`, `brand_profiles` | — |
| `/retailer/samples` | 03 | "Products in the store": cards with QR tag and scans, brand filter, Print all QR tags (client-only print window), swap requests tab, swap modal | `retailer_profiles`, `samples`, `swap_requests`, `products`, `brand_profiles`, `scans` | `POST /api/swap-requests`, `PATCH /api/swap-requests/[id]/status`, `PATCH /api/sample-requests/[id]/status` |
| `/retailer/profile` (new) | 04 | Store profile and payouts: store details, opening hours, photos, logo, payout details, brands in the store | `retailer_profiles` (read/write), `retailer_payout_details` (read/upsert), `brand_retailer_partnerships`, `samples`, `brand_profiles` | Supabase Storage (`ImageUpload`) |
| `/retailer/onboarding` | — (styled after 01) | Store profile form plus logo and photos, then dashboard | `retailer_profiles` (write) | Supabase Storage |
| `/retailer/samples/request` | — | Pick partner brand, products, sizes; request samples (deposit shown) | `retailer_profiles`, `brand_retailer_partnerships`, `brand_profiles`, `products` | `POST /api/sample-requests` |
| `/retailer/samples/transactions` | — | Deposit ledger (paid / refunded / forfeited) | `retailer_profiles`, `sample_transactions`, `samples`, `products`, `brand_profiles` | — |
| `/retailer/brands` | — | Pending invites (accept/decline), active partnerships, request a partnership | `retailer_profiles`, `brand_retailer_partnerships`, `brand_profiles` | `POST /api/partnerships/request` |

Figma items left out because the data isn't loaded today: dashboard Saves, Week/Month/Year toggle, Earnings per month chart, "vs. last month" deltas, "Paid out" date; per-product buys and price on product cards; Brand column in credited purchases (shows Type instead).

**New backend pieces (approved exceptions):**
- `supabase/migrations/004_retailer_profile_details.sql`: `retailer_profiles.opening_hours` (public) and `retailer_payout_details` (reg. no., account no., CVR) with owner-only RLS, because `retailer_profiles` is publicly readable. **Apply with `supabase db push`** before `/retailer/profile` can save.
- `src/lib/database.types.ts` updated for both.
- Token `canvas-warm` (#F4F2EE) in `tailwind.config.ts`.
- `components/brand/image-upload.tsx`: opt-in `appearance="flaym"` (+ `cover`) used by retailer screens; the default look stays for the brand portal. Upload fixes apply everywhere.

Not redesigned (outside `(retailer)`): Figma 01 Login (`/auth/login`, shared by all roles), `/invite/[token]`.

---

## Brand portal: `src/app/(brand)/`

Layout `(brand)/layout.tsx` (C): sidebar nav (Dashboard, Products, Samples, Sample requests, Swap requests, Transactions, Partnerships, Orders). It reads `brand_profiles` and redirects to `/brand/onboarding` until the profile exists.

| Route | What it does | Reads | Calls |
|---|---|---|---|
| `/brand/dashboard` | KPIs (scans, sales, commissions owed, deposits held), top retailers, recent orders | `brand_profiles`, `samples`, `scans`, `products`, `orders`, `attributions`, `retailer_profiles` | — |
| `/brand/onboarding` | Wizard: brand profile plus logo, then first product. Goes to dashboard | `brand_profiles`, `products` (write) | Supabase Storage (`ImageUpload`) |
| `/brand/products` | Product list. Links to new and edit | `brand_profiles`, `products` | — |
| `/brand/products/new` | Create a product with `ProductForm` | `brand_profiles` | `ProductForm` writes `products`, `product_variants`, plus Storage |
| `/brand/products/[id]/edit` | Edit a product with `ProductForm` | `brand_profiles`, `products`, `product_variants` | same as above |
| `/brand/samples` | All samples with QR codes and scan counts; delete a sample | `brand_profiles`, `samples`, `products`, `retailer_profiles`, `scans` | `DELETE /api/samples?id=` |
| `/brand/samples/new` | Create a sample for a partner retailer (generates a QR). Goes to `/brand/samples` | `brand_profiles`, `products`, `brand_retailer_partnerships`, `retailer_profiles` | `POST /api/samples` |
| `/brand/samples/requests` | Incoming retailer sample requests: approve (creates samples, QR codes and deposits) or change status | `brand_profiles`, `sample_requests`, `sample_request_items`, `retailer_profiles`, `products` | `POST /api/sample-requests/[id]/approve`, `PATCH /api/sample-requests/[id]/status` |
| `/brand/samples/swaps` | Swap requests: approve, inspect, refund or forfeit, ship new sample | `brand_profiles`, `swap_requests`, `samples`, `products`, `retailer_profiles` | `PATCH /api/swap-requests/[id]/status` |
| `/brand/samples/transactions` | Deposit ledger (deposits held) | `brand_profiles`, `sample_transactions`, `samples`, `retailer_profiles`, `products` | — |
| `/brand/partnerships` | Partnerships list; invite a retailer by email; request an existing retailer | `brand_profiles`, `brand_retailer_partnerships`, `retailer_profiles` | `POST /api/partnerships/invite`, `POST /api/partnerships/request-retailer` |
| `/brand/orders` | Incoming orders; advance status (pending → confirmed → packed → shipped → delivered, tracking number) | `brand_profiles`, `orders` | `POST /api/orders/[orderId]/status` |

---

## API routes (do not change)

| Route | Method | Called from | Side effects / integrations |
|---|---|---|---|
| `/api/checkout` | POST | consumer checkout | Creates order, items and events; decrements variant stock; spends points (`points_ledger`); attributes to the latest scan (`attributions`); **Resend**: `sendOrderConfirmation` and `sendNewOrderToBrand` |
| `/api/orders/[orderId]/status` | POST | brand orders | Updates status, writes `order_events`; **Resend**: `sendOrderStatusUpdate` |
| `/api/orders/[orderId]/qr` | GET | consumer order detail, `/consumer/qr` | Generates the peer-discovery QR (`qrcode`) |
| `/api/partnerships/invite` | POST | brand partnerships | Creates an invitation token; **Resend**: `sendRetailerInvitation` |
| `/api/partnerships/request-retailer` | POST | brand partnerships | Brand → existing retailer request |
| `/api/partnerships/request` | POST | retailer brands | Retailer → brand request |
| `/api/partnerships/accept` | POST | `/invite/[token]` | Accepts the invite, links the retailer profile |
| `/api/samples` | POST, DELETE | brand samples, samples/new | Creates a sample plus QR (`qrcode` → Storage `brand-assets`), or deletes it |
| `/api/sample-requests` | POST | retailer samples/request | Creates the request plus items |
| `/api/sample-requests/[id]/approve` | POST | brand samples/requests | Creates samples, QR codes (Storage) and `sample_transactions` deposits |
| `/api/sample-requests/[id]/status` | PATCH | brand requests, retailer samples | Status change |
| `/api/swap-requests` | POST | retailer samples | Creates a swap request |
| `/api/swap-requests/[id]/status` | PATCH | brand swaps, retailer samples | Swap lifecycle: deposit refund or forfeit, new sample plus QR (Storage) |
| `/api/saved-products` | POST, DELETE | product page, consumer saved | Wishlist; ties a save to the latest scan for attribution |
| `/api/scans` | POST | product page | Records the scan (retailer or peer attribution, admin client) |

Lib (do not change): `supabase*.ts`, `email.ts` (Resend), `utils.ts` (`formatDKK`, `parseDKKtoOre`, `formatCommission`, `cn`, `generateToken`), `base-url.ts`, `database.types.ts`.

## Components with logic (restyle only; keep the wiring)

- `components/consumer/product-page-client.tsx`: scan recording, save, buy CTA
- `components/brand/product-form.tsx`: product and variant create/update
- `components/brand/image-upload.tsx`: Supabase Storage upload (also used by retailer onboarding)
- `components/consumer/order-timeline.tsx`: status timeline
- `components/providers/auth-provider.tsx`: auth context (logic only, no UI)
- `components/pwa/*`: install prompt, page transition, service worker registration
- `components/ui/skeleton.tsx`, `components/ui/toast.tsx`: to be replaced by `components/ds/` equivalents

## Notes

- `src/middleware.ts` handles auth plus role gating (`/brand`, `/retailer` and `/consumer` are locked to their role; `/`, `/auth`, `/p`, `/d` and `/invite` are public). Don't touch it.
- CLAUDE.md mentions `src/lib/attribution.ts`, `points.ts` and `qr.ts`. **These files don't exist.** That logic lives inside the API routes listed above.
- Auth pages are in `src/app/auth/`, not in an `(auth)/` route group as CLAUDE.md says.
- `tailwind.config.ts` remaps `gray`, `white`, `black` and `cirkle` into the dark "Espresso" theme. Add the new design tokens under new names so screens that haven't been redesigned yet don't change.
- `src/components/ds/` doesn't exist yet. Build it first, from the Figma tokens and components.

---

## Cleanup

**Done (2026-10-14):** removed the empty folders listed below. None of them was tracked by git or contained any files, and Next.js ignores empty folders, so no route or link changed.

- Brace-expansion leftovers: `src/app/{(auth)}`, `{(brand)}/…`, `{(consumer)}/…`, `{(retailer)}/…`
- Empty duplicates of real routes: `src/app/(auth)/`, `(consumer)/{saved,profile,orders}`, `(retailer)/{dashboard,samples,brands,onboarding,invite}`, `(brand)/{dashboard,products,samples,partnerships,orders,onboarding}`
- Empty API folders: `src/app/api/{auth,brand,consumer,retailer,scan}`

**Kept:**
- `src/components/shared` and `src/components/retailer`: empty, but they match the folder structure in CLAUDE.md and the redesign may use them. Git doesn't track empty folders.
- Other:
  - `tsconfig.tsbuildinfo`: build cache, already gitignored, harmless
  - `CLAUDE_CODE_PROMPT.md`: the old build-phase prompts, tracked in git; archive or delete as you like

**Actually used**: everything under `(consumer)/consumer/`, `(retailer)/retailer/`, `(brand)/brand/`, plus `auth/`, `invite/`, `p/`, `d/` and `api/*` (the non-empty ones). Every nav link and redirect points at these.

---

## Flow test checklist (run after each portal is redesigned)

### Auth & gating
- [ ] Sign up as brand, as retailer and as consumer, and land on the correct page for each
- [ ] Log in for each role and land on the correct page; `?redirect=` is honoured
- [ ] Logged out, `/brand/dashboard` redirects to `/auth/login?redirect=…`
- [ ] Wrong role, e.g. a consumer opening `/brand/*`, is redirected to their own dashboard
- [ ] Visiting `/auth/login` while logged in still lets you switch accounts

### Brand
- [ ] A new brand is forced through onboarding (profile, logo upload, first product) and lands on the dashboard
- [ ] Create a product with images and variants; edit it; the changes persist
- [ ] Invite a retailer by email: the Resend invitation arrives and the link opens `/invite/[token]`
- [ ] Request an existing retailer; the request appears for the retailer
- [ ] Create a sample for a partner retailer: the QR is generated and shown; delete the sample
- [ ] Approve a retailer's sample request: samples, QR codes and a deposit transaction are created
- [ ] Swap lifecycle: approve → retailer ships back → inspect → refund or forfeit → new sample is created
- [ ] Transactions page shows deposits held; dashboard KPIs match
- [ ] Advance an order pending → confirmed → packed → shipped (tracking) → delivered; a status email goes out each time

### Retailer
- [ ] Accept an invite, complete onboarding (photos), land on the dashboard
- [ ] Request a partnership with a brand from `/retailer/brands`
- [ ] Request samples (pick products and sizes) and land on `/retailer/samples`
- [ ] Mark a sample request received; request a swap; mark the swap shipped back
- [ ] Transactions page shows deposit capital tied up; dashboard shows scans, sales and commission

### Consumer
- [ ] Scan `/p/[sampleId]` logged out: product page renders and the scan is recorded
- [ ] Save a product, which then appears in `/consumer/saved`; remove it
- [ ] Buy now while logged out goes to signup with a redirect, then back to checkout
- [ ] Checkout with points redeemed: order is created, points are deducted, confirmation email and brand email go out
- [ ] Order detail shows the timeline updating as the brand changes the status
- [ ] Peer QR appears on the order and in `/consumer/qr`
- [ ] A friend scans `/d/[productId]?ref=…` and buys; the attribution is a peer one and the owner earns 50 points
- [ ] Profile shows the points balance and history (100 welcome points)
- [ ] Home shows recent discoveries and saved items

### PWA / responsive
- [ ] Install prompt appears; app installs; service worker registers
- [ ] Every redesigned screen works at 375px width with no horizontal scroll
- [ ] Error page and 404 render in the new design
