# Figma v2: consumer app

Old frame: "Flaym app – user flows" (`8:3`). New frame: "Flaym app v2 – user flows (matches portals v2)" (`378:949`). File `8eKYDZ98E49demFAx7Tjt7`, read 16 November 2026.

The flows and screens are the same; v2 is a visual update. Only the consumer app (PWA) is in scope. The Brand and Retail portals don't change. Rules: see "Redesign rules" in `CLAUDE.md`.

## a) Colours and gradients

### Figma variables: unchanged

The "Flaym / Colour" variables are the same in both frames, and v2 adds no new variables:

| Figma variable | Value | Token |
|---|---|---|
| text/primary (Flare) | #FFFFFF | `flare` |
| text/secondary (Ash) | #D5D1C8 | `ash` |
| text/tertiary (Smoke) | #ACA7A1 | `smoke` |
| line/char (Char) | #7B7673 | `char` |
| brand/flaym (Flaym) | #FF5000 | `flaym` / `accent` |
| surface/obsidian (Obsidian) | #2C2324 | `obsidian` / `primary` |

Every colour change in v2 is a hard-coded fill. In Figma, only text colours and some borders are bound to variables.

### Hard-coded fills: old → v2

| Element | Old | v2 | Token (Part B) |
|---|---|---|---|
| Page background (every solid-background screen) | #2C2324 | **#1A1415** | `canvas-dark` → #1A1415 |
| Primary CTA (full-width buttons, Buy, Pass it on, Pay, Send return request) | #FF5000 | **flame gradient** | `bg-flame-gradient`, Button `variant="flame"` |
| Highlight tiles (08 "Lit" card, 07 "Arriving" banner, 16 highlighted push) | #FF5000 (push: rgba(255,80,0,0.22)) | **flame gradient** | `bg-flame-gradient`, Card `tone="flame"` |
| Card border (cards on the dark page) | none | **1px rgba(255,255,255,0.06)**, inside the box | `border-line-dark-subtle` |
| Tinted pills ("Moved to Owned", "Owned since", "Phase 2") | #FFE3D6 bg / #B33800 text; Phase 2 #FBECD2 / #B26A00 | **rgba(255,80,0,0.12)** bg / #FF5000 text | `bg-accent-tint` + `text-accent` |
| Card fill | #3A2F30 | #3A2F30 (unchanged) | `surface-dark` |
| Tab bar | #2C2324, top border #4A3E3F | unchanged | `primary`, `line-dark` |
| Dividers, toggle track, order-number pill | #4A3E3F | unchanged | `line-dark` |
| Saved "Buy" pill (19) | #FF5000 | unchanged (solid, no gradient) | `accent` |

**Flame gradient:** `#FF8A3D 0%`, `#FF5000 45.833%`, `#D23C00 83.333%`. Figma reports a different CSS angle on each box: 171.55° on 350×52 buttons, 163.13° on the 171.5×52 Buy button, 164.21° on the 350×99 Arriving banner, 168.54° on the 358×73 push card and 148.39° on the 169×104 Lit card. Each angle equals `180° − atan(height / width)`, which is what CSS `linear-gradient(to bottom right, …)` gives. So one token, `linear-gradient(to bottom right, #FF8A3D 0%, #FF5000 45.833%, #D23C00 83.333%)`, matches every box.

**Full-screen gradients (unchanged, 180°):**
- Welcome (01): #D5D1C8 0%, #F08A55 30%, #FF5000 50%, #8A3414 70%, #2C2324 100%. Our `bg-flaym-gradient` uses the older 4-stop version (#D5D1C8, #EE9A6C 50%, #FF5000 70%, #7A2E12); that difference existed before v2.
- Scan (03): #8A3414 0%, #C4501C 30%, #5A2A1C 70%, #2C2324 100% = `bg-flaym-scan`.
- Brand stories (13): #8A3414 0%, #FF5000 45%, #C4501C 70%, #2C2324 100%.
- Lock screen (16): #5A2A1C → #2C2324 at 60%.
- Product image placeholder: #D5D1C8 0%, #EE9A6C 50%, #FF5000 70%, #7A2E12 100%. Only for mock images; the app shows real photos.

**Removed in v2:** #FFE3D6, #B33800, #FBECD2, #B26A00 (the peach and amber pills) and rgba(255,80,0,0.22). In the portals, `accent-subtle`, `accent-strong` and `warning-subtle` stay as they are.

**Possibly unintended in Figma (left as drawn):**
- The tab bar, hollow step dots and active profile tab are still #2C2324 on the new #1A1415 page, so they now read as slightly raised.
- The full-screen gradients (Scan, Stories, Lock screen) still end in #2C2324, not #1A1415.
- Two variable uses in 04c have a `black` fallback instead of the real value: `text/tertiary` on the "Flayms" tab label and `line/char` on the sold-out chip. The variables themselves are correct.

### Other visual changes (not colour)
- **Square corners:** pills, consent toggles, lock-screen push cards, the order-placed check badge (was a circle), the live-map box, checkout payment logos and tab-bar icon wrappers lose their radius. Circles keep theirs: avatars, toggle knob, swatches, radios, step dots, the flash button and the round back button over images. The `rounded-pill` token and the ds `Toggle` stay as they are, because the portals use them. Square these in the consumer screens.
- **Copy:** the only real copy change is on 01 Welcome: "Scan it. Save it. Pass it on." → "Fashion worth wanting." Everything else replaces `[Placeholder]` strings with demo data (Stem, Bonnetje, Wool Overshirt, Nørrebro Store, @ida.k, Freja Holm, DKK prices), which our pages fill from real data already.

### Contrast (WCAG AA: 4.5:1 normal text, 3:1 large text and UI)

| Pair | Ratio | Result |
|---|---|---|
| Flare #FFF on #1A1415 | 18.2 | pass |
| Ash on #1A1415 | 11.9 | pass |
| Smoke on #1A1415 | 7.6 | pass |
| Flaym #FF5000 text on #1A1415 | 5.5 | pass |
| Char on #1A1415 | 4.05 | would fail as text; Char is only for borders |
| Smoke on card #3A2F30 | 5.4 | pass |
| **Flaym #FF5000 text on card #3A2F30** | **3.9** | **fails normal text** (e.g. "Flames lit" value on 18 Owned item, orange text inside dark cards) |
| Flaym text on `accent-tint` pill (over #1A1415) | 4.9 | pass |
| **White on flame gradient, #FF8A3D stop** | **2.35** | **fails, even for large text** |
| **White on flame gradient, #FF5000 stop** | **3.28** | **fails normal text** (passes large text only) |
| White on flame gradient, #D23C00 stop | 4.79 | pass |

Button labels are 14–15px medium, so they count as normal text and need 4.5:1. White on the flame gradient fails AA, worst at the light top-left corner. The current solid #FF5000 buttons already fail (3.28), so this isn't new, but v2 makes it worse. Possible fixes need a design call: darker gradient stops, Obsidian text on the gradient (7.75 / 5.54 / 3.80), or larger bold labels.

## b) Screen checklist (21 v2 screens)

Changes that apply to every solid-background screen, written as "**common**" below: page background `canvas-dark` #1A1415, cards get the `border-line-dark-subtle` border, tab-bar icon wrappers go square.

- [x] **01 Welcome and login** (`378:956`): `src/app/page.tsx` (landing + role buttons); `src/app/auth/signup/page.tsx` (`intro`). Copy "Scan it. Save it. Pass it on." → "Fashion worth wanting." in both. Background gradient unchanged. v2 shows Apple / Google / email sign-in instead of our three role buttons (see c).
- [x] **02 Consent** (`378:969`): `consumer/consent/page.tsx`, `components/consumer/consent-card.tsx`. **Common**; "Start scanning" → `flame`. v2 toggles are square tracks with a round knob; ds `Toggle` stays the same, so square it locally or add a variant. Done: the `dark` tone (consumer only) has a square track.
- [x] **03 Scan** (`378:990`): `consumer/home/page.tsx`. `bg-flaym-scan` unchanged. Tab-bar icon wrappers only. Checked: our `BottomNav` has no icon wrappers, so nothing to change.
- [x] **08 Flayms** (`378:1012`): `consumer/flayms/page.tsx`. **Common**; "Lit" tile `bg-accent` → Card `tone="flame"`; "Passed on" tile gets the border.
- [ ] **12 About (DPP)** (`378:1051`): `d/[productId]/about/page.tsx`. **Common** ("Repair and care" card border). In the v2 mock the repair line runs under the › chevron; keep our layout clear of it.
- [ ] **04b Product page (swipe nudge)** (`378:1078`): `p/[sampleId]/page.tsx`, `d/[productId]/page.tsx`, `components/consumer/product-page-client.tsx` (sets its own `bg-canvas-dark`). **Common**; Buy (hand-built `bg-accent`) → `flame`. Swipe nudge, size chips, sold-out chip and swatches are unchanged.
- [ ] **13 Brand stories** (`378:1125`): `components/consumer/brand-stories-viewer.tsx`. No changes (gradient, progress bars, avatar unchanged).
- [ ] **05 Basket (several brands)** (`378:1146`): `consumer/basket/page.tsx`, `checkout-parts.tsx` (`SummaryCard`, `BottomAction`). **Common**; "Go to checkout" (`BottomAction`) → `flame`.
- [ ] **06 Checkout and payment** (`378:1175`): `consumer/checkout/page.tsx`, `consumer/checkout/[productId]/page.tsx`, `checkout-parts.tsx` (`DarkCard`, `DeliverToCard`, `DeliveryCard`, `PaymentPicker`, `FlaymsCard`). **Common** on all five cards; Pay → `flame`; payment logo tiles square.
- [ ] **14 Order placed** (`378:1208`): `OrderPlaced` in `checkout-parts.tsx`. **Common**; "Follow your order" → `flame`; check badge circle → square (keeps 3px #FF5000 border).
- [ ] **15 Tracking** (`378:1235`): `consumer/orders/[orderId]/page.tsx` (not-delivered state), `components/consumer/order-timeline.tsx`. **Common**; "Phase 2" pill `bg-warning-subtle text-warning` → `bg-accent-tint text-accent`, square; live-map box square. Timeline colours unchanged.
- [ ] **16 Notifications (lock screen)** (`378:1274`): no app screen; these are OS web pushes (`src/lib/push.ts`, `src/lib/order-updates.ts`, `public/sw.js`). Nothing to restyle: the OS draws the notification. The v2 highlight and square cards are mock-only.
- [ ] **17 Delivered** (`378:1299`): `consumer/orders/[orderId]/page.tsx` (`status === 'delivered'`). **Common**; "Moved to Owned" pill `bg-accent-subtle` → `bg-accent-tint text-accent`, square; "Pass it on" → `flame`.
- [ ] **09b Profile – Owned** (`378:1323`): `consumer/profile/page.tsx`, `components/consumer/profile-header.tsx`. **Common** only (tab underline and active tab unchanged).
- [ ] **18 Owned item** (`378:1365`): `consumer/owned/[itemId]/page.tsx`. **Common** on the stats card; "Owned since" pill → `bg-accent-tint text-accent`, square; "Pass it on" → `flame`. "Flames lit" value is orange on the card (contrast, see a).
- [ ] **11 Request a return** (`378:1388`): `consumer/orders/[orderId]/return/page.tsx`. **Common** on the 4 reason cards; "Send return request" → `flame`.
- [ ] **07 Order status** (`378:1412`): `consumer/orders/page.tsx`. **Common** on order cards; "Arriving" banner `bg-accent` → Card `tone="flame"`; order-number pills square.
- [ ] **10b Pass it on (from Owned)** (`378:1454`): `consumer/qr/page.tsx` (detail view with `?order=&product=`). Page background only; white "Share link" button unchanged. The order page's own pass-it-on section (`orders/[orderId]/page.tsx`, Share = `bg-accent`) → `flame` for consistency.
- [ ] **19 Profile – Saved** (`378:1468`): `consumer/saved/page.tsx`. **Common**; "Buy" pills stay solid `bg-accent` but go square.
- [ ] **20 Profile – History** (`378:1514`): `consumer/history/page.tsx`. **Common** only.
- [ ] **04c Product page (from Saved)** (`378:1681`): same `product-page-client.tsx` via `/d/[productId]`. Same as 04b; "Saved at …" copy already exists.

Also restyle (not a separate v2 screen): `BottomNav` stays `bg-primary`; the `(consumer)/layout.tsx` background follows `canvas-dark` automatically.

## c) In v2 but not in the app

Already built, so not on this list: return request (11), tracking steps (15), colour swatches and sold-out chips (04b/04c), "Saved at" (04c), Owned item stats "Passed on / Flames lit / Bought at" (18), tracking number in the order list (07), History "Scanned at / Passed on by" with Today / This week groups (20), push messages per status (16).

| v2 element | Screen | What's missing | Needs |
|---|---|---|---|
| Apple and Google sign-in buttons on the welcome screen | 01 | Only email/password exists; CLAUDE.md lists Apple/Google as planned | **auth / logic** |
| Consumer-first welcome (sign-in buttons instead of our three role buttons "I'm shopping / I'm a brand / I'm a store") | 01 | Our landing page is also the portal role picker | UI only, but changes the portal entry point; needs a decision |
| Carrier and delivery time per brand at checkout ("GLS · 2–3 days", "PostNord · 3–4 days") | 06 | We show "Ships from the brand · 2–3 days"; the carrier is chosen when the brand ships | **data / logic** |
| Delivery fee DKK 45 per brand, included in "Pay DKK 3.740" | 05, 06 | We show a flat 49 kr per brand that isn't charged (`DELIVERY_FEE_ORE`) | **data / logic** (amount and whether it's charged) |
| Expected delivery time window ("Thu 14–17") | 15, 16 | We show an expected day, no time window | **data** |
| "Out for delivery" step with a real state | 15 | Step exists but has no data source (no carrier integration) | **data / logic** |
| Push "On its way with GLS. Expected Thu 14–17." | 16 | Our push is "On its way with GLS." with no ETA | **logic** (`src/lib/order-updates.ts`) + ETA data |
| "One message per step · max one reminder a week" | 16 | One message per step exists; there are no reminders and no weekly limit | **logic** |
| Order numbers like "#FL-20418" | 07, 11, 15 | We show `#{order_number}` (plain number) | UI only, if it's just a display prefix; confirm the format |
| Live map | 15 | Placeholder only, marked "Phase 2" in both Figma versions | **data / logic** (not for this redesign) |
