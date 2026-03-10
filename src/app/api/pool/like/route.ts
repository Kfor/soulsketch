import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendLike } from "@/lib/pool";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { targetUserId } = await request.json();
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    // Prevent self-like
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot like yourself" }, { status: 400 });
    }

    // Check daily contact limit from entitlements
    const { data: entitlement } = await supabase
      .from("entitlements")
      .select("contact_daily_limit")
      .eq("user_id", user.id)
      .single();

    const dailyLimit = entitlement?.contact_daily_limit ?? 3;

    const rateResult = await checkRateLimit(user.id, "contact_like", dailyLimit);
    if (!rateResult.allowed) {
      return NextResponse.json(
        {
          error: "Daily like limit reached. Upgrade to Plus for more!",
          remaining: rateResult.remaining,
          reset_at: rateResult.resetAt.toISOString(),
        },
        { status: 429 },
      );
    }

    const result = await sendLike(supabase, user.id, targetUserId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "Failed to send like" }, { status: 500 });
  }
}
