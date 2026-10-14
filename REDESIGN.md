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

## Consumer portal: `src/app/(consumer)/`

Layout `(consumer)/layout.tsx` (C): mobile bottom nav (Home, Saved, Orders, Profile), `InstallPrompt` and `PageTransition`.

| Route | What it does | Reads | Calls |
|---|---|---|---|
| `/consumer/home` | "Discoveries" feed: recently scanned and saved products, points balance | `scans`, `saved_products`, RPC `get_points_balance` | — |
| `/consumer/saved` | Wishlist (90-day attribution window), remove item | `saved_products` | `DELETE /api/saved-products` |
| `/consumer/orders` | Order list | `orders` | — |
| `/consumer/orders/[orderId]` | Order detail, Wolt-style status timeline (`OrderTimeline`), peer-discovery QR | `orders` | `GET /api/orders/[orderId]/qr` |
| `/consumer/profile` | Profile, points balance plus points history, links (e.g. "My QR codes"), sign out | `profiles`, `points_ledger`, RPC `get_points_balance` | — |
| `/consumer/qr` | "My QR codes": peer QR for every owned product | `orders` | `GET /api/orders/[id]/qr` |
| `/consumer/checkout/[productId]` | Mock checkout: variant, address, redeem points. Logged-out users go to signup with a redirect; on success they go to `/consumer/orders/[id]` | `products`, RPC `get_points_balance` | `POST /api/checkout` |

Product page (used by `/p` and `/d`): `src/components/consumer/product-page-client.tsx`. It records the scan (`POST /api/scans`), handles save/unsave (`/api/saved-products`) and links to "Buy now" → checkout.

---

## Retailer portal: `src/app/(retailer)/`

Layout `(retailer)/layout.tsx` (C): nav (Dashboard, Samples, Transactions, Brands). It reads `retailer_profiles` and redirects to `/retailer/onboarding` until the profile exists.

| Route | What it does | Reads | Calls |
|---|---|---|---|
| `/retailer/dashboard` | KPIs (scans, sales, commission earned, deposit capital tied up), recent activity | `retailer_profiles`, `samples`, `scans`, `attributions`, `brand_retailer_partnerships`, `order_items`, `products`, `brand_profiles` | — |
| `/retailer/onboarding` | Store profile form plus photos (`ImageUpload`), then goes to dashboard | `retailer_profiles` (write) | Supabase Storage |
| `/retailer/samples` | Samples in store with scan counts; request a swap; update swap and sample-request status (e.g. shipped back / received) | `retailer_profiles`, `samples`, `swap_requests`, `products`, `brand_profiles`, `scans` | `POST /api/swap-requests`, `PATCH /api/swap-requests/[id]/status`, `PATCH /api/sample-requests/[id]/status` |
| `/retailer/samples/request` | Pick a partner brand, products and sizes, then request samples (deposit shown). Goes to `/retailer/samples` | `retailer_profiles`, `brand_retailer_partnerships`, `brand_profiles`, `products` | `POST /api/sample-requests` |
| `/retailer/samples/transactions` | Deposit ledger (paid / refunded / forfeited) | `retailer_profiles`, `sample_transactions`, `samples`, `products`, `brand_profiles` | — |
| `/retailer/brands` | Partner brands plus commission rates; request a partnership with a brand | `retailer_profiles`, `brand_retailer_partnerships`, `brand_profiles` | `POST /api/partnerships/request` |

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
- Auth pages are in `src/app/auth/`, not `(auth)/`.
- `tailwind.config.ts` remaps `gray`, `white`, `black` and `cirkle` into the dark "Espresso" theme. Add the new design tokens under new names so screens that haven't been redesigned yet don't change.
- `src/components/ds/` doesn't exist yet. Build it first, from the Figma tokens and components.

---

## Cleanup candidates (nothing deleted yet)

All of the folders below are **empty and not tracked by git**. Next.js ignores empty folders, so **none of them is a live route**. They are probably leftovers from a `mkdir -p` with brace expansion that went wrong.

- Brace-expansion leftovers (literal `{}` in the names):
  - `src/app/{(auth)}`
  - `src/app/{(brand)}/{dashboard,products,samples,partnerships,orders}`
  - `src/app/{(consumer)}/{profile,orders,saved}`
  - `src/app/{(retailer)}/{dashboard,samples,brands}`
- Empty duplicates of real routes:
  - `src/app/(auth)/`: real is `src/app/auth/`
  - `src/app/(consumer)/{saved,profile,orders}`: real is `(consumer)/consumer/*`
  - `src/app/(retailer)/{dashboard,samples,brands,onboarding}`: real is `(retailer)/retailer/*`
  - `src/app/(retailer)/invite/[token]`: real is `src/app/invite/[token]`
  - `src/app/(brand)/{dashboard,products,samples,partnerships,orders,onboarding}`: real is `(brand)/brand/*`
- Empty API folders: `src/app/api/{auth,brand,consumer,retailer,scan}` (the real scan route is `api/scans`)
- Empty component folders: `src/components/shared`, `src/components/retailer`. Keep them if the redesign will use them.
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
