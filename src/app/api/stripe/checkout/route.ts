import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { priceType } = await request.json();

    if (priceType !== "plus" && priceType !== "export") {
      return NextResponse.json({ error: "Invalid price type" }, { status: 400 });
    }

    const priceId =
      priceType === "plus"
        ? process.env.STRIPE_PRICE_PLUS_MONTHLY
        : process.env.STRIPE_PRICE_EXPORT_HD;

    if (!priceId) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const mode = priceType === "plus" ? "subscription" : "payment";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      priceId,
      mode,
      successUrl: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/payment/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
