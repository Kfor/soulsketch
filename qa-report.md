# QA Report — SoulSketch E2E User Journey

**Date:** 2026-03-06
**Tester:** Automated QA (Claude)
**Branch:** `weaver/T1772797074275-qa-soulsketch`
**App URL:** http://localhost:3002
**Verdict:** BLOCKED

---

## Executive Summary

The Next.js dev server starts and renders static/client pages correctly. However, **all three E2E scenarios are blocked** because Supabase (the only database/auth backend) is unavailable. Docker Desktop became unresponsive during setup (stuck prune operation), preventing the local Supabase instance from starting. Every page requiring authentication or database access hangs indefinitely at the loading/session-setup stage.

---

## Infrastructure Status

| Service | Status | Notes |
|---------|--------|-------|
| Next.js dev server | Running (port 3002) | Renders correctly |
| Supabase (local) | NOT RUNNING | Docker daemon stuck on prune; `supabase start` failed |
| Docker Desktop | UNRESPONSIVE | `docker version` times out; prune deadlock |
| OpenAI APIs | Not tested | Requires Supabase first for session context |
| Stripe | Not tested | Requires Supabase for user context |

**Root cause:** Another Supabase project (`hukio`) occupied ports 54321-54326. Configuring SoulSketch on alternate ports succeeded for DB init but failed when `supabase stop` triggered a Docker volume prune that deadlocked the daemon. All subsequent Docker operations (including `docker ps`, `curl` to existing containers) hang.

---

## Scenario 1: Draw Soulmate Portrait

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1.1 | Open http://localhost:3002 | Homepage with "Draw Your Soulmate" button | Homepage renders correctly with button, gallery, pool section | **PASS** |
| 1.2 | Click "Draw Your Soulmate →" | Navigate to /age-gate | Navigates to /age-gate with two buttons | **PASS** |
| 1.3 | Click "I'm 18 or older" | Navigate to /chat | Navigates to /chat | **PASS** |
| 1.4 | Chat page loads session | AI asks first preference question | Stuck at "Setting up your session..." (Supabase auth hangs) | **FAIL** |
| 1.5 | Answer preference questions | Portrait preview updates | BLOCKED — cannot reach chat UI | **BLOCKED** |
| 1.6 | Complete all rounds | Results card displayed | BLOCKED | **BLOCKED** |
| Data | Chat records persisted | In `chat_messages` table | BLOCKED — no DB | **BLOCKED** |

**Screenshots:** `qa-evidence/01-homepage.png`, `qa-evidence/02-age-gate.png`, `qa-evidence/03-chat-initial.png`

**Code Review Notes:**
- Chat flow uses a question graph (`q1_gender` → `q2_body_type` → `q3_vibe` → `q4_style` → `q5_hair` → terminal) — well structured
- Phases: `sketch` → `ai_gen` → `calibration` → `done`
- All chat messages are persisted to `chat_messages` table via Supabase
- Session summary accumulates tags per answer; used for portrait generation prompt
- Image generation falls back to SVG placeholder when `AI_IMAGE_API_KEY` is not set
- LLM falls back to canned responses when `AI_LLM_API_KEY` is not set
- **Issue:** No loading timeout or error UI — `ensureAnonymousAuth()` hangs forever when Supabase is unreachable. The `finally { setInitializing(false) }` block in the `init` function should fire, but the Supabase client appears to never reject/resolve when the server is down.

---

## Scenario 2: Join Matching Pool

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 2.1 | Navigate to /pool/join | Pool join form | Stuck on loading spinner (auth hangs) | **FAIL** |
| 2.2 | Fill form & submit | Join pool | BLOCKED | **BLOCKED** |
| 2.3 | Email verification | Verified & in pool | BLOCKED | **BLOCKED** |
| 2.4 | Navigate to /discover | Candidate cards | BLOCKED | **BLOCKED** |
| 2.5 | Click heart button | Like recorded | BLOCKED | **BLOCKED** |
| 2.6 | Refresh — state persists | Like status retained | BLOCKED | **BLOCKED** |
| Data | `contact_requests` record | Row in table | BLOCKED — no DB | **BLOCKED** |

**Screenshot:** `qa-evidence/04-pool-join.png`

**Code Review Notes:**
- Pool join page requires auth, uploads photo to Supabase Storage `pool-photos` bucket
- Discover page uses vector ANN search via `search_pool_candidates` RPC
- Like action inserts into `contact_requests` and checks for mutual match
- Same auth-hanging issue as chat page

---

## Scenario 3: Share & Viral Growth

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 3.1 | Share button on results | Generate share link | BLOCKED — cannot reach results | **BLOCKED** |
| 3.2 | Open /share/{token} | Result card (no login) | Server-side render timeout (Supabase unreachable) | **FAIL** |
| 3.3 | Click CTA button | Navigate to homepage | BLOCKED | **BLOCKED** |
| Data | `invites` table record | Row in table | BLOCKED — no DB | **BLOCKED** |

**Code Review Notes:**
- Share page is server-rendered (`createServiceSupabase()`) — queries `share_links` and `chat_messages`
- Has proper OG metadata with dynamic image URL (`/api/og/{token}`)
- CTA links to `/chat` (not homepage `/`) — **minor discrepancy** with spec which says "跳转回首页"
- Share link has 30-day expiry with proper expired/invalid state handling

---

## Issues Found

### Critical (Blocking QA)

| # | Severity | Description | Repro |
|---|----------|-------------|-------|
| 1 | CRITICAL | **Supabase dependency — no graceful degradation.** All authenticated pages hang indefinitely when Supabase is unreachable. No timeout, no error message, no retry button. | Start app without Supabase → navigate to /chat, /pool/join, or /discover |

### Medium

| # | Severity | Description | Location |
|---|----------|-------------|----------|
| 2 | MEDIUM | **No auth timeout/error handling.** `ensureAnonymousAuth()` and Supabase client calls never time out, leaving users stuck at "Setting up your session..." forever. Should show error after ~10s with retry option. | `src/app/chat/page.tsx:64`, `src/lib/auth.ts` |
| 3 | MEDIUM | **Share CTA links to /chat instead of /** (spec says homepage). | `src/app/share/[token]/page.tsx:98` — `href="/chat"` should be `href="/"` |
| 4 | MEDIUM | **Share page server render hangs** when Supabase is down, causing full page timeout instead of graceful fallback. | `src/app/share/[token]/page.tsx:30-33` |

### Low

| # | Severity | Description | Location |
|---|----------|-------------|----------|
| 5 | LOW | **Supabase config has `[project]` key** incompatible with CLI v2.72+. Changed to `project_id` during QA. | `supabase/config.toml:1` |

---

## Recommendations

1. **Fix Docker and re-run QA**: Restart Docker Desktop to clear the prune deadlock, then `supabase start` and re-execute all scenarios.
2. **Add auth timeout**: Wrap `ensureAnonymousAuth()` with a `Promise.race` timeout (~10s) and show an error UI with retry.
3. **Fix share CTA link**: Change `/chat` to `/` in share page.
4. **Fix Supabase config**: Commit the `project_id` fix.

---

## Evidence Files

| File | Description |
|------|-------------|
| `qa-evidence/01-homepage.png` | Homepage — "Draw Your Soulmate" button visible |
| `qa-evidence/02-age-gate.png` | Age gate — two buttons visible |
| `qa-evidence/03-chat-initial.png` | Chat page — stuck at "Setting up your session..." |
| `qa-evidence/04-pool-join.png` | Pool join — stuck on loading spinner |
