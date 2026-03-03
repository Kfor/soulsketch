# SoulSketch E2E QA Report

**Date**: 2026-03-03
**PRD**: `docs/prds/soulsketch-ai-soulmate-drawing-matching-web-app.md`
**Branch**: `weaver/T1772515636023-qa-end-to-end-verification-of-soulsketch-prd-doc`
**Method**: Static code-path analysis against PRD requirements

---

## Overall Verdict: FAIL

**Summary**: 3 of 7 scenarios pass. 4 scenarios fail due to disconnected wiring, missing UI triggers, hardcoded flags, and absent features. The backend foundations (DB schema, RLS, Stripe webhook, RPC functions) are solid, but several end-to-end paths are broken at the integration layer.

| # | Scenario | Verdict |
|---|----------|---------|
| 1 | Anonymous chat flow → sketch phases → AI portrait → 3 result cards + watermark | **PASS** (with bugs) |
| 2 | Progressive login: selfie → email OTP → data migration | **FAIL** |
| 3 | Pool opt-in → photos → recommendations → Like → mutual Like → contact | **FAIL** |
| 4 | Stripe checkout → payment → webhook → entitlements → HD export | **FAIL** |
| 5 | Share link → friend opens → sees card → CTA back to chat | **PASS** |
| 6 | Invite code → invitee completes flow → inviter gets reward | **PASS** (with gap) |
| 7 | Security: RLS, rate limiting, age gate | **PASS** (with caveat) |

---

## Scenario 1: Anonymous Chat Flow → Sketch Phases → AI Portrait → 3 Result Cards + Watermark

### Verdict: PASS (with non-blocking bugs)

The core happy path works end-to-end: anonymous auth → 5-question graph → AI portrait generation → zodiac calibration → 3 result cards (portrait, keywords, zodiac chart) with watermark overlay.

**Passing checks (27/32)**:
- Anonymous auth auto-triggers on page load (`src/app/chat/page.tsx:64`)
- Profile + entitlements auto-created via DB trigger (`00001_initial_schema.sql:284-295`)
- ChatGPT-style layout: scrollable messages + bottom input + option cards
- Question graph: 5 rounds with correct `detail_level` progression (outline→simple→detailed)
- 9 pre-made SVG sketch assets exist in `public/sketches/`
- Terminal node triggers AI generation with DALL-E 3 (`src/lib/ai/image-generator.ts`)
- Rate limiting on AI generation (5/day, DB-backed)
- Content moderation on user input (regex blocklist)
- Calibration phase collects zodiac sign with validation
- 3 result cards rendered: `PortraitCard`, `KeywordCard`, `ZodiacCard`
- Watermark overlay at 30% opacity on free tier images
- Session recovery on page refresh (loads messages from DB)
- Graceful fallbacks when API keys are not configured

**Bugs found (non-blocking)**:

| ID | Severity | Description | Location |
|----|----------|-------------|----------|
| B1 | **HIGH** | Gender tag key mismatch: question graph writes `{ gender: "male" }` but `buildImagePrompt()` reads `summary.gender_pref`. Gender preference is never included in AI image prompts. | `question-graph.ts:21` vs `llm-engine.ts:126` |
| B2 | **MODERATE** | No server-side low-res enforcement for free tier. Images served at full 1024×1024. Watermark is CSS-only (client-side, bypassable). | `image-generator.ts:33` |
| B3 | **MINOR** | First chat message has no sketch image (`content_image_url: null`). PRD says Phase 1 should show a rough outline from round 1. Sketch only appears after answering Q1. | `chat/page.tsx:157` |
| B4 | **MINOR** | Supabase `.insert()` errors silently swallowed in chat API route (error not destructured/checked in ~7 locations). | `api/chat/route.ts:135-138` et al. |

---

## Scenario 2: Progressive Login — Selfie → Email OTP → Data Migration

### Verdict: FAIL

The individual pieces exist in isolation but are not connected into a working pipeline. The end-to-end flow is completely broken.

| Sub-requirement | Status | Details |
|-----------------|--------|---------|
| `ensureAnonymousAuth()` on page load | **PASS** | `src/lib/auth.ts:3-14`, called at `chat/page.tsx:64` |
| Selfie upload UI in calibration phase | **FAIL** | No file upload UI, no upload endpoint. Comment at `api/chat/route.ts:401` says "Ask for selfie" but code only re-prompts zodiac. `SessionSummary.selfie_url` field defined but never written. |
| Selfie triggers email OTP dialog | **FAIL** | `setShowEmailDialog(true)` is **never called** anywhere in the codebase. No `useRequireBinding` hook exists. No `src/hooks/` directory. |
| `linkEmailOTP()` correctly links email | **FAIL** | Uses `signInWithOtp()` instead of `updateUser()`. This creates a new session, replacing the anonymous user — doesn't bind email to anonymous account. |
| Data migration from anon → real account | **FAIL** | `/api/auth/migrate` route exists and is well-structured but is **never called** from any client code. `onLinked` callback is a no-op (only closes dialog). No anonymous ID is captured before OTP verification. |
| `EmailLinkDialog` wired up | **FAIL** | Component rendered but never opened. `onLinked` doesn't call migrate API or refresh session. |

**Root cause**: The progressive auth plan specified a `useRequireBinding` hook and `AuthProvider` context that were never implemented. The trigger chain (selfie upload → binding dialog → OTP verify → migration) has no working connections.

---

## Scenario 3: Pool Opt-in → Photos → Recommendations → Like → Mutual Like → Contact

### Verdict: FAIL

The happy path is partially functional but has critical gaps in mutual-like logic, missing features, and incorrect limit accounting.

| Sub-requirement | Status | Details |
|-----------------|--------|---------|
| Join form collects required data | **FAIL** | Missing "basic tags" field. Photo upload limited to 1 file, not 1-3 per PRD. |
| Photo upload works | **PASS** | Storage bucket + DB record + signed URLs for recommendations. |
| Recommendation RPC called correctly | **PASS** | `search_pool_candidates` with all filter params, cosine similarity. |
| Daily limits enforced (5 free / 50 plus) | **FAIL** | Decrement is per-API-call (1), not per-candidate-returned. No daily reset mechanism. No join reward ("10 recommendations today"). |
| Mutual like auto-accept | **FAIL** | RLS bug: `contact_requests` UPDATE policy is `USING (auth.uid() = to_user)`. When auto-accepting mutual match, the update to the current user's own request (where `to_user != auth.uid()`) silently fails RLS. |
| View matches / accepted contacts | **FAIL** | No matches page, no contacts list, no API to list accepted matches. Match badge is transient client state lost on reload. |
| Block/report | **FAIL** | Entirely missing. `blocked` status defined in schema but no code sets it. No report table or endpoint. |
| Discover page gated by `is_in_pool` | **PASS** | Redirects to `/pool/join` if not in pool. |
| Email verification on join | **FAIL** | Not enforced. Anonymous users can join pool. |
| Like rate limiting | **FAIL** | `contact_daily_limit` exists in entitlements but is never checked in like API. |

---

## Scenario 4: Stripe Checkout → Payment → Webhook → Entitlements → HD Export

### Verdict: FAIL

Backend payment processing is correct. The critical failure is that the frontend never reads entitlements — users pay but see no change.

| Sub-requirement | Status | Details |
|-----------------|--------|---------|
| Checkout creates Stripe sessions (both modes) | **PASS** | Payment + subscription modes, correct price IDs, user reference. |
| Webhook validates Stripe signature | **PASS** | `request.text()` + `constructEvent()` — correct for App Router. |
| `checkout.session.completed` updates entitlements | **PASS** | One-time: 3 export credits. Sub: plan=plus, all limits raised. |
| `customer.subscription.deleted` downgrades | **PASS** | All values reset to free defaults. |
| Raw body parsing for Stripe webhook | **PASS** | App Router `request.text()` provides raw body. |
| Entitlement values correct | **PASS** | Schema defaults, upgrade values, and downgrade values all consistent. |
| **UI reflects entitlement state** | **FAIL** | `isFreeTier={true}` hardcoded at `chat/page.tsx:330,343`. No entitlements fetch. Watermark shows forever. |
| **HD export download** | **FAIL** | No HD export API route. `is_highres` always `false`. No export_credits consumption logic. |
| Payment success/cancel pages | **PASS** | Both pages exist with appropriate content. |

---

## Scenario 5: Share Link → Friend Opens → Sees Card → CTA Back to Chat

### Verdict: PASS

| Sub-requirement | Status | Details |
|-----------------|--------|---------|
| Token generation (30-day expiry) | **PASS** | Crypto-secure 12-char token, 30-day TTL. |
| Share page resolves token → shows preview → CTA | **PASS** | SSR with service role, blurred portrait, "Draw Your Soulmate" CTA. |
| OG/social meta tags | **PASS** | OpenGraph + Twitter Card with dynamic OG image via `next/og`. |
| Preview blurred | **PASS** | CSS `blur-xl brightness-75`. |
| Expired token handling | **PASS** | Graceful degradation with CTA still present. |

---

## Scenario 6: Invite Code → Invitee Completes Flow → Inviter Gets Reward

### Verdict: PASS (with gap)

| Sub-requirement | Status | Details |
|-----------------|--------|---------|
| Unique code generation | **PASS** | Crypto-random 8-char, 55-char alphabet, DB UNIQUE constraint. |
| Redemption validates + prevents self-invite | **PASS** | RPC lookup + explicit self-invite check. |
| Reward ladder applied | **FAIL** | `hd_export` (count=2) defined in ladder but never applied to any entitlement. No column or logic to enable HD. Tier 1 (export_credits) and Tier 3 (daily_draws_left) work. |
| Inviter entitlements updated | **PASS** | export_credits and daily_draws_left updated correctly. |
| Status endpoint shows progress | **PASS** | Returns invites, redeemed count, earned/next rewards. |

---

## Scenario 7: Security — RLS, Rate Limiting, Age Gate

### Verdict: PASS (with caveat)

| Sub-requirement | Status | Details |
|-----------------|--------|---------|
| RLS on `pool_photos` blocks cross-user reads | **PASS** | `auth.uid() = user_id` on SELECT + storage policies. |
| RLS on `generated_assets` blocks cross-user reads | **PASS** | `auth.uid() = user_id` on SELECT. |
| Rate limiting for anon generation | **PASS** | DB-backed, 5 req/24hr, optimistic concurrency. |
| Middleware rate limiting (10 req/hr) | **PASS** | In-memory Map per IP for `/api/chat` and `/api/generate-image`. |
| Age gate blocks <18 | **PASS** | Client-side check on chat and homepage. |
| **Age gate server-side enforceable** | **FAIL** | Purely client-side localStorage. No middleware/API enforcement. Trivially bypassable. |
| Content moderation | **PASS** | Regex blocklist in chat route. OpenAI API available but not wired. |
| SECURITY DEFINER RPCs restrict fields | **PASS** | All 3 RPCs expose minimal fields with `search_path = public`. |

---

## Critical Issues Summary (Ranked by Impact)

| # | Severity | Issue | Scenario |
|---|----------|-------|----------|
| 1 | **CRITICAL** | `isFreeTier` hardcoded to `true` — paid users see no change after Stripe payment | S4 |
| 2 | **CRITICAL** | Progressive login pipeline completely disconnected — email dialog never opens, migration never called | S2 |
| 3 | **CRITICAL** | Mutual like auto-accept fails due to RLS policy on `contact_requests` UPDATE | S3 |
| 4 | **HIGH** | No matches/contacts page — mutual matches have no way to be viewed or used | S3 |
| 5 | **HIGH** | No HD export API — export_credits granted but no consumption/download mechanism | S4 |
| 6 | **HIGH** | Gender tag key mismatch — AI portraits ignore gender preference | S1 |
| 7 | **HIGH** | No block/report functionality in pool | S3 |
| 8 | **HIGH** | `linkEmailOTP()` uses `signInWithOtp` instead of `updateUser` — creates new session instead of binding | S2 |
| 9 | **MODERATE** | No daily limit reset mechanism for recommendations | S3 |
| 10 | **MODERATE** | Recommendation decrement logic counts API calls, not candidates returned | S3 |
| 11 | **MODERATE** | Age gate is client-side only — no server enforcement | S7 |
| 12 | **MODERATE** | No server-side low-res enforcement — CSS watermark trivially bypassable | S1 |
| 13 | **MODERATE** | Like rate limiting not enforced (`contact_daily_limit` never checked) | S3 |
| 14 | **LOW** | HD export invite reward (tier 2) defined but never applied | S6 |
| 15 | **LOW** | First chat message has no sketch image | S1 |
| 16 | **LOW** | Supabase insert errors silently swallowed in chat API | S1 |

---

## Recommendations

### Must-fix for MVP launch:
1. Wire entitlements fetch into `chat/page.tsx` to derive `isFreeTier` from DB
2. Fix gender tag key mismatch (`gender` → `gender_pref` in question graph)
3. Fix mutual-like RLS by using service role client for auto-accept updates
4. Create HD export API endpoint with `export_credits` consumption
5. Build matches/contacts page for accepted mutual likes

### Should-fix:
6. Implement selfie upload in calibration phase + progressive login trigger
7. Add block/report endpoints and UI for pool
8. Fix recommendation daily limit decrement logic
9. Add server-side age gate enforcement (at minimum a cookie + middleware check)
10. Add daily limit reset mechanism (cron or on-read check)

### Nice-to-have:
11. Server-side image watermarking/resizing for free tier
12. Wire OpenAI moderation API into chat flow
13. Add email verification requirement for pool join
14. Multi-photo upload (1-3) for pool join
