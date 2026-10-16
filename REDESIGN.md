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

**Redesigned (Oct 2026):** `/` (after Figma App 01 Welcome), `/auth/login` (Brand/Retail Portal 01 Login), `/auth/signup` and `/invite/[token]` (styled after Portal 01). Login, signup and invite share `components/shared/auth-shell.tsx` (gradient art panel + form column; a short band on mobile). All use `bg-flaym-gradient`.

Figma items left out: App 02 Consent (no consent storage), Continue with Apple / Google (no OAuth in the code: there's no `signInWithOAuth` call anywhere), Forgot password (no reset flow), the terms line (no terms page). `error.tsx` and `not-found.tsx` are not redesigned yet.

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
| `/brand/samples/swaps` | — | Swap lifecycle: approve / cancel, inspect (note), ship replacement, complete | `brand_profiles`, `swap_requests`, `samples`, `products`, `retailer_profiles` | `PATCH /api/swap-requests/[id]/status` |
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
- `components/ui/skeleton.tsx`, `components/ui/toast.tsx`: to be replaced by `components/ds/` equivalents

## Notes

- `src/middleware.ts` handles auth plus role gating (`/brand`, `/retailer` and `/consumer` are locked to their role; `/`, `/auth`, `/p`, `/d` and `/invite` are public). Don't touch it.
- CLAUDE.md mentions `src/lib/attribution.ts`, `points.ts` and `qr.ts`. **These files don't exist.** That logic lives inside the API routes listed above.
- Auth pages are in `src/app/auth/`, not in an `(auth)/` route group as CLAUDE.md says.
- `tailwind.config.ts` remaps `gray`, `white`, `black` and `cirkle` into the dark "Espresso" theme. Add the new design tokens under new names so screens that haven't been redesigned yet don't change.
- `src/components/ds/` doesn't exist yet. Build it first, from the Figma tokens and components.

## Open decisions

- **Sending email (no emails arrive yet).** Tested 2026-10-16: a brand invite to a real address returned 200 but no email arrived. `RESEND_API_KEY` is set, but no sender domain has been set up: `EMAIL_FROM` is unset, so `src/lib/email.ts` sends from `noreply@cirkle.dk`, and that domain isn't verified in Resend, so Resend rejects the send. `sendEmail` also ignores the result Resend returns, so failures leave no error in the logs. Affects every email: retailer invitations, order confirmation, new order to brand, order status updates. To decide:
  - Which domain and sender address to use (e.g. a Flaym domain, since the product is now Flaym rather than Cirkle), then verify it in Resend (DNS records) and set `EMAIL_FROM`.
  - Whether `sendEmail` should log or surface Resend errors (a change to `src/lib`, so outside the redesign rules).
  - The email templates still say "Cirkle" with the old blue styling; rebrand them to Flaym at the same time.

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
- [ ] Returns: a consumer return request appears on `/brand/returns`; approve → mark received → mark refunded (needs 003)
- [ ] Account: edit brand details and payouts, save, reload, values persist (needs 007)
- [ ] Dashboard Saves shows a number after 006 is applied

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
