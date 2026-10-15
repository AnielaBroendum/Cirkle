# Open decisions

Found while testing the consumer redesign (Oct 2026). These change business
logic, so they need a product decision before anyone touches the code.

---

## 1. Retailer commission rates

**What CLAUDE.md promises**

| Case | Rate |
|---|---|
| Direct: bought in the same session as the retailer scan | 25% |
| Deferred: bought within 90 days of the scan | 15% |
| Tier 2: a *different* product from the same brand, within 90 days | 10% |
| Peer: bought via a friend's QR | 50 points to the friend (no money) |

**What the code does** (`src/app/api/checkout/route.ts`)

- It finds the shopper's most recent retailer or peer scan **of the product being bought**, within the last 90 days (older scans are ignored, so they earn nothing).
- Retailer scan → always `deferred`, 15%. `direct` and `tier2` exist in the database enum but are never written.
- No matching scan of this product → no attribution, even if the shopper scanned another product from the same brand (so no tier 2).

**Effect today:** same-session sales are underpaid by 10 percentage points, and brand discovery (tier 2) earns retailers nothing.

### Questions to decide

1. **What counts as "the same session" for the 25% rate?**
   - a) within N minutes of the scan (e.g. 60 or 120)?
   - b) the same calendar day?
   - c) no other scan in between (scan → buy without browsing elsewhere)?
2. **Tier 2:** which scan counts? The most recent scan of *any* product by that brand, at that retailer, within 90 days?
3. **Retailer vs. peer, if both exist:** today "last scan wins". Keep that, or should a retailer scan always beat a peer scan (or the reverse)?
4. **Saved products:** a save is tied to a scan for 90 days. Should buying from Saved count as deferred (15%) even if there's a newer scan of that product elsewhere?
5. **Basket checkout:** each item becomes its own order and is attributed separately. Is that right when the basket holds items found at different stores?
6. **Commission base:** % of the full price, or of the price after the Flayms (points) discount? Today it's 15% of the full price.
7. **Existing orders:** recalculate past attributions under the new rules, or only apply them to new orders?

---

## 2. Welcome points timing

- **CLAUDE.md:** 100 points on account creation.
- **Code:** the checkout API adds `welcome_bonus` (100) during the shopper's **first order**, after the order is created.
- **Effect:** a new shopper has 0 Flayms at their first checkout, so the "Use Flayms" card never shows and the welcome points can only be used from the second order on.

### Options

- **A. Grant at sign-up.** Matches CLAUDE.md. A database trigger (or the sign-up flow) adds 100 points when a consumer profile is created; the checkout stops adding them. Needs a migration, plus a backfill decision for consumers who signed up but haven't ordered yet.
- **B. Keep at first order.** Treat it as a first-order thank-you; update CLAUDE.md and the app copy ("Welcome bonus" → "First-order bonus").

### Questions to decide

1. Should the first order be able to use the welcome points?
2. Can points be abused by creating many accounts (option A)? Do we need a limit (e.g. one per email/phone, or only after email confirmation)?
3. Do existing consumers without an order get the 100 points retroactively?

---

## Decided (Oct 2026)

| Item | Decision |
|---|---|
| `/api/scans` trusts the browser's user ID | Fixed: the scanner is taken from the session |
| "Sign in" / "Create account" links drop `?redirect=` | Fixed: both links keep `redirect` (and `role`) |
| Friend names show as "a friend" | Keep as is (privacy) |
| Signed-out scans not recorded | Fixed: `/api/scans` is public in the middleware |
