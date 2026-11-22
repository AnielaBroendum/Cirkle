# TestFlight — consumer app as an iPhone app

Plan: wrap the existing web app in a Capacitor shell that loads the live site (https://app.flaymforward.com) and add native features. No payments and no Shopify integration in this round; products stay managed in the brand portal. Rules: "TestFlight rules" in `CLAUDE.md`.

Legend: `[x]` done, `[ ]` to do. "In code" says what already existed when the item was planned.

## Session 1 — Web app ready for the shell

### Part A — Setup
- [x] `figma-update` merged into `main` (checked; both figma-v2 branches too)
- [x] Branch `testflight` from `main`
- [x] "TestFlight rules" in `CLAUDE.md`
- [x] This checklist

### Part A2 — Move to app.flaymforward.com
In code: `src/lib/base-url.ts` (`getBaseUrl`) already builds QR tag and peer links from `NEXT_PUBLIC_QR_BASE_URL` / `NEXT_PUBLIC_APP_URL`, falling back to the request origin. Manifest uses relative URLs. Auth sends no `emailRedirectTo`; `/auth/callback` uses its own origin. No Open Graph images, no `metadataBase`.
- [x] One variable `NEXT_PUBLIC_APP_URL` for the app's address (`getAppUrl()` for code without a request)
- [x] Store invite email links (`/api/partnerships/invite`) and copied invite links use it
- [x] Flayms share link uses it
- [x] QR scanner recognises the app host and old hosts
- [x] `metadataBase` in the root layout
- [x] Old addresses (`NEXT_PUBLIC_LEGACY_HOSTS=cirkle-tan.vercel.app`, found by decoding the stored tag PNGs) redirect permanently to the same path on app.flaymforward.com
- [ ] Tags made on a dev machine (3 in production point at `Anielas-MacBook-Air.local:3000`) can't be redirected: re-render their PNGs or make new tags
- [x] Native app: `/` goes to Scan; web keeps the welcome screen
- [ ] Supabase URL Configuration, Vercel env + redeploy (you)
- [ ] Live test: login, new tag, flame link, old tag redirect (redirect checked locally: `cirkle-tan.vercel.app/p/…` and `/d/…?ref=` → 308 to app.flaymforward.com, path and query kept)

### Part B — Login without confirmation emails
In code: sign-up already logs in straight away (no "check your email" screen). No Forgot password, magic link or social login exists.
- [x] "Confirm email" off in Supabase (you)
- [x] Test (2026-11-22, local production build against the live database): new shopper lands on the consent screen signed in, no email step; log out and log in again work

### Part C — Delete account (Apple 5.1.1(v))
In code: nothing. `orders.consumer_user_id` and `returns.user_id` cascade-deleted with the user.
- [x] Migration 032: orders and returns keep a null user instead of being deleted
- [x] `POST /api/account/delete`: anonymises orders, deletes the auth user (personal rows cascade)
- [x] "Delete account" with confirmation (inline panel under Sign out) in the consumer profile
- [x] 032 applied to production (2026-11-22)
- [x] Test: test shopper with one mock order (#46, QA Atelier) deleted. Gone: auth user, profile, points, consents. Kept with user NULL: order (name "Deleted user", address blank), its item and store attribution, 3 scans, 4 events

### Part D — Buy without payments
In code: no Capacitor package. Buy adds to the basket; checkout creates mock orders.
- [x] `@capacitor/core` 8.6.0 + `src/lib/native.ts` (`isNativeApp`, `useIsNativeApp`)
- [x] Native only: Buy shows "Coming soon" (product page, saved list; basket and checkout via `NativeBuyGuard` layouts)

### Follow-ups found
- [ ] A peer link (`/d/…?ref=`) from a deleted shopper: the scan's `source_user_id` points at a profile that no longer exists, so recording that scan fails. Decide whether to drop `ref` for unknown users (touches scan recording)
- [ ] `EMAIL_FROM` and the VAPID subject still default to `@cirkle.dk`; use an address on a domain verified in Resend
- [ ] Test order #46 (QA Atelier, pending) can be cancelled in the brand portal

## Session 2 — Capacitor shell
- [ ] To be filled in from the next brief (iOS project, `server.url` from env, icons, splash)

## Session 3 — Native features
- [ ] To be filled in (e.g. camera scanning, push via APNs with server-only keys)

## Session 4 — TestFlight
- [ ] To be filled in (signing, App Store Connect, privacy labels, upload)
