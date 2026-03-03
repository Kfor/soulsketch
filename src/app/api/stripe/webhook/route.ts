import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase/server";

// Disable body parsing — Stripe needs the raw body
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceSupabase();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId) break;

        if (session.mode === "payment") {
          // One-time export purchase: grant export credits
          await supabase
            .from("entitlements")
            .update({ export_credits: 3 }) // HD + 2 extra versions
            .eq("user_id", userId);
        } else if (session.mode === "subscription") {
          // Plus subscription
          await supabase
            .from("entitlements")
            .update({
              plan: "plus",
              plan_expires_at: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              search_daily_limit: 50,
              contact_daily_limit: 20,
              daily_draws_left: 20,
              daily_recos_left: 50,
            })
            .eq("user_id", userId);

          // Save subscription ID
          if (session.subscription) {
            await supabase
              .from("entitlements")
              .update({ stripe_subscription_id: session.subscription as string })
              .eq("user_id", userId);
          }
        }

        // Save Stripe customer ID
        if (session.customer) {
          await supabase
            .from("profiles")
            .update({ stripe_customer_id: session.customer as string })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        // Find user by subscription ID and downgrade
        const { data: entitlement } = await supabase
          .from("entitlements")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (entitlement) {
          await supabase
            .from("entitlements")
            .update({
              plan: "free",
              plan_expires_at: null,
              search_daily_limit: 5,
              contact_daily_limit: 3,
              daily_draws_left: 5,
              daily_recos_left: 5,
              stripe_subscription_id: null,
            })
            .eq("user_id", entitlement.user_id);
        }
        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
