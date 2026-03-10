#!/usr/bin/env bash
# Provision Stripe products and prices for SoulSketch.
# Usage:
#   ./scripts/stripe-provision.sh          # test mode (default)
#   ./scripts/stripe-provision.sh --live   # live/production mode
#
# Prerequisites:
#   - Stripe CLI installed and authenticated (`stripe login`)
#   - For live mode: `stripe login` with live mode access
#
# Output: prints the env vars to add to .env.local (or Vercel env settings)

set -euo pipefail

LIVE_FLAG=""
MODE="test"
if [[ "${1:-}" == "--live" ]]; then
  LIVE_FLAG="--live"
  MODE="live"
fi

echo "=== Provisioning Stripe products ($MODE mode) ==="
echo ""

# 1. Create HD Export product + price ($3.99 one-time)
echo "Creating SoulSketch HD Export product..."
EXPORT_PRODUCT=$(stripe products create \
  $LIVE_FLAG \
  --name="SoulSketch HD Export" \
  --description="One-time HD export with 2 extra versions" \
  --format=json 2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "//;s/".*//')

echo "  Product: $EXPORT_PRODUCT"

EXPORT_PRICE=$(stripe prices create \
  $LIVE_FLAG \
  --product="$EXPORT_PRODUCT" \
  --unit-amount=399 \
  --currency=usd \
  --format=json 2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "//;s/".*//')

echo "  Price:   $EXPORT_PRICE ($3.99 one-time)"

# 2. Create Plus Monthly product + price ($9.99/mo recurring)
echo "Creating SoulSketch Plus product..."
PLUS_PRODUCT=$(stripe products create \
  $LIVE_FLAG \
  --name="SoulSketch Plus" \
  --description="Monthly subscription with unlimited features" \
  --format=json 2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "//;s/".*//')

echo "  Product: $PLUS_PRODUCT"

PLUS_PRICE=$(stripe prices create \
  $LIVE_FLAG \
  --product="$PLUS_PRODUCT" \
  -d "recurring[interval]=month" \
  --unit-amount=999 \
  --currency=usd \
  --format=json 2>/dev/null | grep '"id"' | head -1 | sed 's/.*: "//;s/".*//')

echo "  Price:   $PLUS_PRICE ($9.99/mo recurring)"

# 3. Print env vars
echo ""
echo "=== Add these to your .env.local (or Vercel dashboard for production): ==="
echo ""
echo "STRIPE_PRICE_EXPORT_HD=$EXPORT_PRICE"
echo "STRIPE_PRICE_PLUS_MONTHLY=$PLUS_PRICE"
echo ""

if [[ "$MODE" == "live" ]]; then
  echo "=== Also set these live-mode keys (from https://dashboard.stripe.com/apikeys): ==="
  echo ""
  echo "STRIPE_SECRET_KEY=sk_live_..."
  echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_..."
  echo "STRIPE_WEBHOOK_SECRET=whsec_..."
  echo ""
  echo "=== Create a webhook endpoint at https://dashboard.stripe.com/webhooks ==="
  echo "  URL: https://your-domain.com/api/stripe/webhook"
  echo "  Events: checkout.session.completed, customer.subscription.deleted"
fi
