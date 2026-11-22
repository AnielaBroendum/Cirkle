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
- [ ] One variable `NEXT_PUBLIC_APP_URL` for the app's address (`getAppUrl()` for code without a request)
- [ ] Store invite email links (`/api/partnerships/invite`) and copied invite links use it
- [ ] Flayms share link uses it
- [ ] QR scanner recognises the app host and old hosts
- [ ] `metadataBase` in the root layout
- [ ] Old addresses (`LEGACY_HOSTS`, a `*.vercel.app` domain) redirect permanently to the same path on app.flaymforward.com
- [ ] Native app: `/` goes to Scan; web keeps the welcome screen
- [ ] Supabase URL Configuration, Vercel env + redeploy (you)
- [ ] Live test: login, new tag, flame link, old tag redirect

### Part B — Login without confirmation emails
In code: sign-up already logs in straight away (no "check your email" screen). No Forgot password, magic link or social login exists.
- [ ] "Confirm email" off in Supabase (you, done)
- [ ] Test: new user is logged in straight away

### Part C — Delete account (Apple 5.1.1(v))
In code: nothing. `orders.consumer_user_id` and `returns.user_id` cascade-deleted with the user.
- [ ] Migration 032: orders and returns keep a null user instead of being deleted
- [ ] `POST /api/account/delete`: anonymises orders, deletes the auth user (personal rows cascade)
- [ ] "Delete account" with confirmation in the consumer profile
- [ ] 032 applied to production
- [ ] Test: delete a test account and check what's left

### Part D — Buy without payments
In code: no Capacitor package. Buy adds to the basket; checkout creates mock orders.
- [ ] `@capacitor/core` + `src/lib/native.ts` (`isNativeApp`, `useIsNativeApp`)
- [ ] Native only: Buy shows "Coming soon" (product page, saved list, basket, checkout)

## Session 2 — Capacitor shell
- [ ] To be filled in from the next brief (iOS project, `server.url` from env, icons, splash)

## Session 3 — Native features
- [ ] To be filled in (e.g. camera scanning, push via APNs with server-only keys)

## Session 4 — TestFlight
- [ ] To be filled in (signing, App Store Connect, privacy labels, upload)
