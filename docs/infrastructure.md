# Infrastructure & External Services

## 1. External Services Inventory

### 1.1 Supabase (Database, Auth, Storage)

| Aspect | Detail |
|--------|--------|
| Packages | `@supabase/ssr` ^0.6.1, `@supabase/supabase-js` ^2.49.1 |
| Auth methods | Email OTP, anonymous sign-in |
| Database | PostgreSQL 15 with `pgvector` extension |
| Storage | `pool-photos` bucket (private, user-scoped, 50 MiB limit) |
| Local ports | API: 54321, DB: 54322 |

**Tables (12 total):**

| # | Table | RLS | Purpose |
|---|-------|-----|---------|
| 1 | `profiles` | owner-only | User profile (display_name, gender_pref, age_bucket, city, zodiac, stripe_customer_id) |
| 2 | `entitlements` | owner-only | Plan & usage limits (plan, export_credits, daily_draws_left, stripe_subscription_id) |
| 3 | `persona_sessions` | owner-only | Chat sessions (status, current_phase, summary_json, pref_embedding vector(1536)) |
| 4 | `chat_messages` | session-owner | Conversation history (role, content_text, content_options, sketch_level) |
| 5 | `sketch_assets` | public read | Pre-made sketch resources (tags, detail_level, storage_path) |
| 6 | `generated_assets` | owner-only | AI-generated portraits/cards (asset_type, is_highres, version) |
| 7 | `pool_photos` | owner-only | Dating pool profile photos |
| 8 | `search_logs` | owner-only | Query tracking |
| 9 | `contact_requests` | from/to user | Likes & matches (status: pending/accepted/rejected/blocked) |
| 10 | `invites` | inviter-only | Referral codes (code, invitee_id, is_valid) |
| 11 | `rate_limits` | service-role only | Per-device/IP rate tracking |
| 12 | `share_links` | owner-only | Public session sharing tokens (expires 30 days) |

**RPC Functions (SECURITY DEFINER):**

| Function | Auth | Purpose |
|----------|------|---------|
| `search_pool_candidates(query_embedding, ...)` | user | Vector ANN search (IVFFlat cosine) with demographic filters |
| `lookup_invite_code(invite_code)` | user | Prevents invite code enumeration |
| `get_pool_count()` | public | Returns pool_members and sketches_created counts |

**Triggers:**

| Trigger | Event | Action |
|---------|-------|--------|
| `on_auth_user_created` | `AFTER INSERT ON auth.users` | Auto-creates `profiles` + `entitlements` rows |

### 1.2 Stripe (Payments)

| Aspect | Detail |
|--------|--------|
| Package | `stripe` ^20.4.0 |
| Client lib | `src/lib/stripe.ts` |
| Products | Plus monthly subscription, HD export one-time purchase |

**API routes:**

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stripe/checkout` | POST | required | Create checkout session |
| `/api/stripe/webhook` | POST | none (signature verified) | Handle `checkout.session.completed`, `customer.subscription.deleted` |

Webhook updates `entitlements` (plan, credits, limits) and `profiles` (stripe_customer_id) on successful payment.

### 1.3 OpenAI-compatible LLM (Chat)

| Aspect | Detail |
|--------|--------|
| Package | None (raw `fetch`) |
| Client lib | `src/lib/chat/llm-engine.ts` |
| Default model | `gpt-4o` |
| Default endpoint | `https://api.openai.com/v1/chat/completions` |

Generates chat responses during the `ai_gen` phase. Endpoint and model are configurable via env vars — can point to any OpenAI-compatible API. Falls back to canned responses when API key is not set.

### 1.4 OpenAI-compatible Image Generation (DALL-E 3)

| Aspect | Detail |
|--------|--------|
| Package | None (raw `fetch`) |
| Client lib | `src/lib/ai/image-generator.ts` |
| API route | `/api/generate-image` (POST, auth required) |
| Default endpoint | `https://api.openai.com/v1/images/generations` |

Generates portrait images. Falls back to SVG placeholder when API key is not set.

### 1.5 OpenAI Moderations API (Content Safety)

| Aspect | Detail |
|--------|--------|
| Package | None (raw `fetch`) |
| Client lib | `src/lib/security/content-moderator.ts` |
| Endpoint | `https://api.openai.com/v1/moderations` |

Optional. Local regex-based filtering runs first; API moderation is a second pass if `MODERATION_API_KEY` is configured. Fails open on API errors.

---

## 2. Environment Variables

All variables are defined in `.env.example`. Copy to `.env.local` for local development.

### Supabase

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | `http://localhost:54321` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | — | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | — | Supabase admin key (bypasses RLS) |

### AI — LLM

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `AI_LLM_API_KEY` | server only | — | Bearer token for chat completions API |
| `AI_LLM_API_URL` | server only | `https://api.openai.com/v1/chat/completions` | Chat completions endpoint |
| `AI_LLM_MODEL` | server only | `gpt-4o` | Model identifier |

### AI — Image Generation

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `AI_IMAGE_API_KEY` | server only | — | Bearer token for image generation API |
| `AI_IMAGE_API_URL` | server only | `https://api.openai.com/v1/images/generations` | Image generation endpoint |

### Content Moderation

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `MODERATION_API_KEY` | server only | — | Optional. OpenAI Moderations API key |

### Rate Limiting

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ANON_GENERATIONS` | server only | `5` | Max anonymous AI generations per window |
| `RATE_LIMIT_WINDOW_MS` | server only | `86400000` | Rate limit window in ms (default 24 h) |

### Stripe

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | server only | — | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | server only | — | Stripe webhook signature secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client + server | — | Stripe publishable key |
| `STRIPE_PRICE_EXPORT_HD` | server only | — | Stripe Price ID for one-time HD export |
| `STRIPE_PRICE_PLUS_MONTHLY` | server only | — | Stripe Price ID for Plus monthly subscription |

### App

| Variable | Exposure | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | client + server | `http://localhost:3000` | Public app URL (used for OG images, share links) |

---

## 3. Local Development Setup

### Prerequisites

- **Node.js** 22+
- **pnpm** 9.15+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Supabase CLI** ([install guide](https://supabase.com/docs/guides/cli/getting-started))
- **Stripe CLI** (optional, for webhook testing — [install guide](https://docs.stripe.com/stripe-cli))

### Steps

```bash
# 1. Clone & install
git clone <repo-url> && cd SoulSketch
pnpm install

# 2. Start local Supabase (Docker must be running)
supabase start
# Note the anon key and service_role key printed in the output

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local:
#   - Set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
#     from `supabase start` output
#   - Set AI_LLM_API_KEY and AI_IMAGE_API_KEY if you want AI features
#     (app works without them — uses fallback responses/placeholders)
#   - Set Stripe keys if testing payments (optional for core features)

# 4. Apply database migrations
supabase db reset
# This runs all migrations in supabase/migrations/ and seeds the schema

# 5. (Optional) Set up Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET in .env.local

# 6. Start dev server
pnpm dev
# App available at http://localhost:3000
```

### Verify connectivity

| Service | How to verify |
|---------|---------------|
| Supabase | `supabase status` — should show running services |
| Next.js | Visit `http://localhost:3000` — page loads without errors |
| Database | Visit `http://localhost:54323` — Supabase Studio with tables visible |
| AI APIs | Start a chat session — if configured, AI responses appear; otherwise fallback text |
| Stripe | Create a checkout — if configured, redirects to Stripe; otherwise shows error |

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│                                                     │
│  Next.js App (React 19 + Tailwind 4)               │
│  ├─ Chat UI → /api/chat                            │
│  ├─ Portrait Gen → /api/generate-image             │
│  ├─ Pool Browse → /api/pool/*                      │
│  ├─ Payments → /api/stripe/checkout                │
│  ├─ Sharing → /api/share/*                         │
│  └─ Supabase Client (auth, realtime)               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│               Next.js API Routes (Server)           │
│                                                     │
│  /api/chat ──────────────┬──► LLM API (OpenAI)     │
│  /api/generate-image ────┤   ┌──────────────────┐   │
│  /api/pool/* ────────────┤   │ AI Services      │   │
│  /api/stripe/* ──────────┤   │ • Chat (gpt-4o)  │   │
│  /api/auth/migrate ──────┤   │ • Images (DALL-E)│   │
│  /api/invites/* ─────────┤   │ • Moderation     │   │
│  /api/share/* ───────────┤   └──────────────────┘   │
│  /api/og/[token] ────────┘                          │
│                                                     │
│  Middleware: rate limiting, auth session refresh     │
└────────┬──────────────────────────────┬─────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐    ┌──────────────────────┐
│      Supabase       │    │       Stripe         │
│                     │    │                      │
│  Auth               │    │  Checkout Sessions   │
│  ├─ Email OTP       │    │  Subscriptions       │
│  └─ Anonymous       │    │  Webhooks ──────────►│
│                     │    │   └─► /api/stripe/   │
│  PostgreSQL 15      │    │       webhook        │
│  ├─ 12 tables       │    └──────────────────────┘
│  ├─ RLS policies    │
│  ├─ pgvector        │
│  │  └─ IVFFlat idx  │
│  ├─ 3 RPC functions │
│  └─ 1 trigger       │
│                     │
│  Storage            │
│  └─ pool-photos     │
└─────────────────────┘
```

### Data Flow: Chat Session

```
User message
  → Middleware (rate limit check)
    → POST /api/chat
      → content-moderator (local regex + optional API)
      → Load session from persona_sessions
      → If phase=ai_gen: call LLM API → store response in chat_messages
      → Update session phase/summary
      → Return response
```

### Data Flow: Pool Matching

```
User joins pool
  → POST /api/pool/join
    → Upload photo to Supabase Storage (pool-photos bucket)
    → Update profiles (is_in_pool, demographics)

User browses recommendations
  → POST /api/pool/recommendations
    → Load user's pref_embedding from latest completed session
    → RPC search_pool_candidates (vector ANN + demographic filters)
    → Return candidate list

User likes someone
  → POST /api/pool/like
    → Insert contact_request
    → Check for mutual match (both sides liked)
    → Return match status
```

### Data Flow: Payments

```
User clicks upgrade
  → POST /api/stripe/checkout
    → Create Stripe Checkout Session (subscription or one-time)
    → Return checkout URL → redirect to Stripe

Stripe completes payment
  → POST /api/stripe/webhook (signature verified)
    → checkout.session.completed:
      → Update profiles.stripe_customer_id
      → Update entitlements (plan=plus, increased limits/credits)
    → customer.subscription.deleted:
      → Downgrade entitlements to free plan defaults
```
