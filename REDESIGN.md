# Cirkle redesign: inventory

The new Figma UI was a reskin: functionality did not change. **Finished 2026-10-16**: the Espresso theme is removed and every screen uses the Flaym tokens and `src/components/ds/` (documented in `CLAUDE.md` → Conventions → Design system). This file stays as the route inventory and the flow test checklist.

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

**Redesigned (Oct 2026):** `/` (after Figma App 01 Welcome), `/auth/login` (Brand/Retail Portal 01 Login), `/auth/signup` and `/invite/[token]` (styled after Portal 01). Login, signup and invite share `components/shared/auth-shell.tsx` (gradient art panel + form column; a short band on mobile). All use `bg-flaym-gradient`.

Figma items left out: App 02 Consent (on hold, see below), Continue with Apple / Google (no OAuth in the code: there's no `signInWithOAuth` call anywhere), Forgot password (no reset flow), the terms line (no terms page). `error.tsx` and `not-found.tsx` were redesigned last (Oct 16): `bg-canvas`, uppercase Plex Mono heading, accent button.

**On hold: App 02 Consent** (Figma node 8:18, "Before you scan"). Dark screen with three toggles in a `surface-dark` card: Data for the chain (required, always on), Share my data with brands (on by default in Figma), News from brands (max one email a week, off). Then an accent "Start scanning" button. Two decisions are open before building it:
- **Storage:** nothing stores consent today. Options: a new migration (`consumer_consents` table, owner-only RLS, each choice plus a timestamp; recommended, since brand sharing and marketing email are GDPR consents you need to prove), auth user metadata (touches auth calls), or UI only (not safe beyond a preview).
- **Placement:** after shopper signup (signup → `/consumer/consent` → `/consumer/home`, with `?redirect=` still winning; this changes the consumer signup redirect), or a standalone page linked from profile settings.
- Note: Figma has "Share my data with brands" on by default. Under GDPR, optional consents should start off.

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
| `/retailer/samples` | 03 | "Products in the store": cards with QR tag and scans, brand filter, Print all QR tags (client-only print window), sample requests tab (status, items, deposit, Confirm received when shipped), swap requests tab, swap modal | `retailer_profiles`, `samples`, `swap_requests`, `sample_requests`, `sample_request_items`, `products`, `brand_profiles`, `scans` | `POST /api/swap-requests`, `PATCH /api/swap-requests/[id]/status`, `PATCH /api/sample-requests/[id]/status` |
| `/retailer/profile` (new) | 04 | Store profile and payouts: store details, opening hours, photos, logo, payout details, brands in the store | `retailer_profiles` (read/write), `retailer_payout_details` (read/upsert), `brand_retailer_partnerships`, `samples`, `brand_profiles` | Supabase Storage (`ImageUpload`) |
| `/retailer/onboarding` | — (styled after 01) | Store profile form plus logo and photos, then dashboard | `retailer_profiles` (write) | Supabase Storage |
| `/retailer/samples/request` | — | Pick partner brand, products, sizes; request samples (deposit shown) | `retailer_profiles`, `brand_retailer_partnerships`, `brand_profiles`, `products` | `POST /api/sample-requests` |
| `/retailer/samples/transactions` | — | Deposit ledger (paid / refunded / forfeited) | `retailer_profiles`, `sample_transactions`, `samples`, `products`, `brand_profiles` | — |
| `/retailer/brands` | — | Pending invites (accept/decline), active partnerships, request a partnership | `retailer_profiles`, `brand_retailer_partnerships`, `brand_profiles` | `POST /api/partnerships/request` |

Figma items left out because the data isn't loaded today: dashboard Saves, Week/Month/Year toggle, Earnings per month chart, "vs. last month" deltas, "Paid out" date; per-product buys and price on product cards; Brand column in credited purchases (shows Type instead).

**New backend pieces (approved exceptions):**
- `supabase/migrations/004_retailer_profile_details.sql`: `retailer_profiles.opening_hours` (public) and `retailer_payout_details` (reg. no., account no., CVR) with owner-only RLS, because `retailer_profiles` is publicly readable. **Apply with `supabase db push`** before `/retailer/profile` can save.
- `src/lib/database.types.ts` updated for both.
- `supabase/migrations/005_retailer_order_items_read.sql`: RLS select policy so a retailer can read `order_items` of orders attributed to their store (product names in the dashboard's credited list; before this they showed "Unknown product"). No access to `orders` or consumer data. **Apply like 004.**
- Token `canvas-warm` (#F4F2EE) in `tailwind.config.ts`.
- `components/brand/image-upload.tsx`: opt-in `appearance="flaym"` (+ `cover`) used by retailer screens; the default look stays for the brand portal. Upload fixes apply everywhere.

Figma 01 Login (`/auth/login`, shared by all roles) and `/invite/[token]` are done as shared screens (see Shared / public).

---

## Brand portal: `src/app/(brand)/` (redesigned to Figma "Brand Portal (desktop)", Oct 2026)

Layout `(brand)/layout.tsx` (C): dark ds `SidebarNav` (Dashboard, Products, Stores & QR tags, Orders, Returns; Account and Log out at the bottom) on `bg-canvas-warm`. It reads `brand_profiles` and redirects to `/brand/onboarding` until onboarding is complete (unchanged). Figma has desktop frames only; mobile uses the SidebarNav drawer. "Stores & QR tags" stays active on `/brand/samples/*` and `/brand/partnerships` (`NavItem.match`; `SidebarNav` now honours it, an approved ds fix). Those pages share a sub-tab row (`components/brand/stores-tabs.tsx`: Products in stores · Sample requests · Swaps · Deposits · Partnerships).

| Route | Figma | What it does | Reads | Calls |
|---|---|---|---|---|
| `/brand/dashboard` | 02 | Day / Week / Month / Year toggle; Scans, Saves, Purchases, Sales via Flaym (+ store cut) with deltas vs. the previous period; activity chart; By store; Top products; commission, deposits held, recent activity | `brand_profiles`, `products`, `samples`, `scans`, `orders`, `attributions`, `retailer_profiles`, `order_items`, RPC `get_brand_save_counts` | — |
| `/brand/products` | 03 | Product library: search, All / In stores / Inactive, active toggle, delete (ds Modal confirm) | `brand_profiles`, `products`, `samples` (stores per product) | — |
| `/brand/products/new`, `/brand/products/[id]/edit` | 04 | `ProductForm` in two columns: fields + stock per variant; images + stores holding a sample | `brand_profiles`, `products`, `product_variants`, `samples`, `retailer_profiles` | `ProductForm` writes `products`, `product_variants`, Storage |
| `/brand/samples` | 05 | Products-in-stores hub: store list (partner stores, waiting invitations / requests, available stores), the store's samples with QR tag, scans, deposit and open swap; select + print QR tags (client-only print window); Invite store modal; request partnership; delete sample | `brand_profiles`, `samples`, `products`, `retailer_profiles`, `scans`, `brand_retailer_partnerships`, `swap_requests` | `DELETE /api/samples?id=`, `POST /api/partnerships/invite`, `POST /api/partnerships/request-retailer` |
| `/brand/samples/new` | — (after 04) | Add sample: product + partner store, generates the QR | `brand_profiles`, `products`, `brand_retailer_partnerships`, `retailer_profiles` | `POST /api/samples` |
| `/brand/samples/requests` | — | Sample requests: approve, reject (reason), ship (tracking) | `brand_profiles`, `sample_requests`, `sample_request_items`, `retailer_profiles`, `products` | `POST /api/sample-requests/[id]/approve`, `PATCH /api/sample-requests/[id]/status` |
| `/brand/samples/swaps` | — | Swap lifecycle: approve / cancel, mark returned sample received, inspect (note), ship replacement, complete | `brand_profiles`, `swap_requests`, `samples`, `products`, `retailer_profiles` | `PATCH /api/swap-requests/[id]/status` |
| `/brand/samples/transactions` | — | Deposits ledger (table on desktop, list on mobile; money out shows "−") | `brand_profiles`, `sample_transactions`, `samples`, `retailer_profiles`, `products` | — |
| `/brand/partnerships` | — (part of 05) | Incoming requests (accept / decline), pending invitations (copy link), active, available stores (request with commission), inactive; Invite store modal | `brand_profiles`, `brand_retailer_partnerships`, `retailer_profiles` | `POST /api/partnerships/invite`, `POST /api/partnerships/request-retailer` |
| `/brand/orders` | 06 | New / In progress / Shipped / Delivered / All; table + detail panel (bottom sheet below xl): ship to, items, the chain (credited store or "Passed on by a friend"), history, next step with tracking | `brand_profiles`, `orders` (+ items, events, profile), `attributions`, `retailer_profiles` | `POST /api/orders/[orderId]/status` |
| `/brand/returns` (new) | 07 | Return requests on the brand's orders: Decline / Approve, then Mark received, Mark refunded; Open / All | `returns`, `order_items`, `orders`, `products` (update `returns.status` under the 003 RLS) | — |
| `/brand/account` (new) | 08 | Brand (name, webshop, return policy link, order email read-only, about, logo) and payouts (reg. no., account no., CVR) | `brand_profiles` (read/write), `brand_payout_details` (read/upsert) | Supabase Storage (`ImageUpload`) |
| `/brand/onboarding` | — (after 01) | Split art/form wizard: brand profile + logo, then first product; goes to dashboard | `brand_profiles`, `products` (write) | Supabase Storage |

Figma items left out because the data or feature doesn't exist: Export settlement (dashboard); product import, Source column and product-level SKU (03/04); the per-store product checkboxes that add/remove products (05; "Add" links to `/brand/samples/new` instead); Chain ID (06); brand agreement card (08).

**New backend pieces (approved exceptions):**
- `supabase/migrations/006_brand_save_counts.sql`: `get_brand_save_counts(p_since)`, a security-definer function returning daily save counts for the caller's own products only (no user ids). Until applied, the dashboard's Saves tile shows "–".
- `supabase/migrations/007_brand_account_details.sql`: `brand_profiles.return_policy_url` and `brand_payout_details` with owner-only RLS (mirrors 004). Until applied, the return policy and payout fields on `/brand/account` are disabled with a note.
- **Apply both with `supabase db push`.** `src/lib/database.types.ts` is updated for both.
- `/brand/returns` needs migration 003 (already required by the consumer return flow). No returns emails yet.
- `components/brand/invite-store-modal.tsx` holds the invite form that used to live on the partnerships page (same API call and defaults). `components/brand/image-upload.tsx`: every caller now uses `appearance="flaym"`, so the default look is unused.

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
- `components/ui/` was deleted on 2026-10-16; skeletons and toasts now come from `components/ds/`

## Notes

- `src/middleware.ts` handles auth plus role gating (`/brand`, `/retailer` and `/consumer` are locked to their role; `/`, `/auth`, `/p`, `/d` and `/invite` are public). Don't touch it.
- CLAUDE.md mentions `src/lib/attribution.ts`, `points.ts` and `qr.ts`. **These files don't exist.** That logic lives inside the API routes listed above.
- Auth pages are in `src/app/auth/`, not in an `(auth)/` route group as CLAUDE.md says.
- The Espresso theme (remapped `gray`/`white`/`black`/`cirkle`, plus `espresso`, `terracotta`, `gold`, `sage`, Inter and Fraunces) was removed from `tailwind.config.ts`, `globals.css` and the root layout on 2026-10-16. `gray-*`, `white` and `black` are Tailwind defaults again, but they're not part of the design.
- The `/auth/ds-preview` page was deleted on 2026-10-16.

## Open decisions

- **Public domain for QR and share links. TODO (Aniela): give Claude the public domain** (Vercel URL or the Flaym domain) so it can update `.env.local` and `.env.example`; then set the same two variables in Vercel. `.env.local` sets `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_QR_BASE_URL` to the Mac's LAN name (`Anielas-MacBook-Air.local:3000`), so peer share links and newly printed sample tags only open on the same Wi-Fi. Set both to the public domain (locally and in Vercel). Sample tag PNGs keep the host they were created with, so tags made before the switch need reprinting; peer QR codes are generated on demand and update by themselves.
- **Store commission rates.** `/api/checkout` attributes every store sale as `deferred` at a hardcoded 15%. The spec's direct (25%, same session) and tier-2 (10%, another product from the same brand) rates are never used, and the per-partnership rates in `brand_retailer_partnerships` are ignored. Decide how "direct" is detected (e.g. bought within 24 h of the scan, or the scan id carried through checkout) before changing it.
- **Welcome points timing.** CLAUDE.md says 100 points on account creation; the code grants them in `/api/checkout` on the first purchase, so a new shopper sees 0 and can't redeem anything on their first order. Options: a migration with a trigger on consumer profile creation (keep the checkout grant as an idempotent fallback), or keep it and change the docs.
- **Returned items can still be passed on.** A delivered order that was later returned and refunded still shows its peer QR as "ready to pass on" (`/api/orders/[orderId]/qr` only checks `status = delivered`), so the owner can earn Flayms on an item they no longer have. Decide whether a refunded return should hide the QR.
- **Migrations not applied:** 006 (dashboard Saves, `get_brand_save_counts`) and 007 (brand payout details). Run them in the Supabase SQL editor; the pages already handle both being missing.

- **Sending email (no emails arrive yet).** Tested 2026-10-16: a brand invite to a real address returned 200 but no email arrived. `RESEND_API_KEY` is set, but no sender domain has been set up: `EMAIL_FROM` is unset, so `src/lib/email.ts` sends from `noreply@cirkle.dk`, and that domain isn't verified in Resend, so Resend rejects the send. Affects every email: retailer invitations, order confirmation, new order to brand, order status updates. To decide:
  - Which domain and sender address to use (e.g. a Flaym domain, since the product is now Flaym rather than Cirkle), then verify it in Resend (DNS records) and set `EMAIL_FROM`.
  - ~~Whether `sendEmail` should log Resend errors~~: done 2026-10-17, rejected sends are now logged with Resend's error. The templates are rebranded to Flaym; the fallback sender is `Flaym <noreply@cirkle.dk>` until `EMAIL_FROM` is set.

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

## Flow test checklist

**Final run 2026-10-16** against `next dev` on :3000 at 375px, with test accounts on `@flaym.test` (logins in the gitignored `.env.test-accounts.local`). [x] = passed, [~] = passed with a note, [ ] = not tested.

### Auth & gating
- [x] Sign up as brand, as retailer and as consumer, and land on the correct page for each (brand → onboarding, retailer via invite → onboarding, consumer → back to the basket via `?redirect=`)
- [x] Log in for each role and land on the correct page; `?redirect=` is honoured
- [x] Logged out, `/brand/dashboard` redirects to `/auth/login?redirect=…`
- [x] Wrong role, e.g. a consumer opening `/brand/*`, is redirected to their own dashboard (tested retailer → `/brand/dashboard`)
- [x] Visiting `/auth/login` while logged in still lets you switch accounts

### Brand
- [x] A new brand is forced through onboarding (profile, logo upload, first product) and lands on the dashboard
- [x] Create a product with images and variants; edit it; the changes persist
- [~] Invite a retailer by email: invitation and link created, link opens `/invite/[token]` and accept works. No email arrives (Resend sender domain not set up, see Open decisions)
- [ ] Request an existing retailer; the request appears for the retailer (skipped: the only other stores belong to non-test accounts)
- [x] Create a sample for a partner retailer: the QR is generated and shown; delete the sample
- [x] Approve a retailer's sample request: samples, QR codes and a deposit transaction are created
- [x] Swap lifecycle: approve → retailer ships back → brand marks received → inspect → refund or forfeit → new sample is created (the "Mark received" button was missing until 2026-10-17)
- [x] Transactions page shows deposits held; dashboard KPIs match
- [~] Advance an order pending → confirmed → packed → shipped (tracking) → delivered. No status emails arrive (Resend, see Open decisions)
- [x] Returns: a consumer return request appears on `/brand/returns`; approve → mark received → mark refunded (needs 003)
- [~] Account: brand details save and persist. Payouts and return policy link show the "database update" notice: migration 007 isn't applied (`brand_payout_details` 404)
- [ ] Dashboard Saves shows a number after 006 is applied (006 isn't applied: `get_brand_save_counts` 404, card shows "Not available yet")

### Retailer
- [x] Accept an invite, complete onboarding (photos), land on the dashboard
- [ ] Request a partnership with a brand from `/retailer/brands` (skipped: the only other brands belong to non-test accounts)
- [x] Request samples (pick products and sizes) and land on `/retailer/samples`
- [x] Mark a sample request received; request a swap; mark the swap shipped back
- [x] Transactions page shows deposit capital tied up; dashboard shows scans, sales and commission

### Consumer
- [x] Scan `/p/[sampleId]` logged out: product page renders and the scan is recorded
- [x] Save a product, which then appears in `/consumer/saved`; remove it
- [x] Buy now while logged out goes to signup with a redirect, then back to checkout (via the basket)
- [~] Checkout with points redeemed: order is created, points are deducted. Emails don't arrive (Resend)
- [x] Order detail shows the timeline updating as the brand changes the status
- [x] Peer QR appears on the order and in `/consumer/qr`
- [x] A friend scans `/d/[productId]?ref=…` and buys; the attribution is a peer one and the owner earns 50 points
- [~] Profile shows the points balance and history. The 100 welcome points are granted on the first purchase (in `/api/checkout`), not at signup
- [~] Home is now the Scan screen (Figma App 03); camera is blocked in the test browser so only the fallback was seen. Discoveries and saved items are under Profile → History / Saved

### PWA / responsive
- [ ] Install prompt appears; app installs; service worker registers (not testable in dev: `sw-register` unregisters in development. Manifest name and icons fixed 2026-10-17; check on a production deploy)
- [x] Every redesigned screen works at 375px width with no horizontal scroll
- [~] Error page and 404 render in the new design (404 checked under `/auth/…`; logged out, other unknown paths go to login via the middleware. `error.tsx` checked by build only)
