# Testing Environment

## Prerequisites

- Node.js 22+
- pnpm 10+
- Stripe CLI (for webhook testing)
- Playwright chromium browser (`npx playwright install chromium`)

## Setup

```bash
# Install dependencies
pnpm install

# Copy env file
cp .env.example .env.local
# Fill in: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

## Running Tests

### Unit Tests (Vitest)

```bash
pnpm vitest run
```

### E2E Tests (Playwright)

```bash
npx playwright test
```

### Build Verification

```bash
pnpm build

# Stripe webhook local testing
# Terminal 1: pnpm dev
# Terminal 2: stripe listen --forward-to localhost:3000/api/stripe/webhook
# Terminal 3: stripe trigger checkout.session.completed
```

## Test Accounts

- Stripe test mode keys (sk_test_xxx / pk_test_xxx)
- Test card: 4242424242424242 (any future expiry, any CVC)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in Supabase credentials for integration testing.

For unit tests, Supabase is fully mocked — no credentials needed.
For UI-only E2E testing, Supabase is not required (graceful degradation).

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `OPENAI_API_KEY` - OpenAI API key for DALL-E and GPT
- `AI_IMAGE_PROVIDER` - Image provider name (default: "dalle")
- `MAX_FREE_REFINEMENTS` - Max free refinements per session (default: 5)
- `STRIPE_SECRET_KEY` - Stripe test secret key
- `STRIPE_WEBHOOK_SECRET` - From `stripe listen` output (whsec_xxx)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe test publishable key

## Test Structure

- `src/__tests__/hooks/` — Hook tests (useAuth, useAnonymousLogin, useRequireBinding)
- `src/__tests__/components/` — Component tests (BindingDialog)
- `src/__tests__/services/` — Service tests (migrateAnonymousData)
- `e2e/` — Playwright E2E tests (chat UI)

## Test Architecture

- Unit tests use Vitest with mocked dependencies
- No external API calls in tests (all OpenAI/Supabase calls are mocked)
- E2E tests use Playwright with Chromium
- The dev server auto-starts via Playwright config when running E2E tests
- For Supabase-dependent tests, a local Supabase instance is required (`npx supabase start`)
- UI rendering tests work without Supabase (graceful degradation)
