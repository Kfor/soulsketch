import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { getRecommendations } from "@/lib/pool";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { filters } = await request.json();

    // Check entitlements for daily limit
    const { data: entitlement } = await supabase
      .from("entitlements")
      .select("plan, daily_recos_left")
      .eq("user_id", user.id)
      .single();

    const limit = entitlement?.plan === "plus" ? 50 : 5;

    if (entitlement && entitlement.daily_recos_left <= 0) {
      return NextResponse.json({
        error: "Daily recommendation limit reached",
        upgrade: entitlement.plan === "free",
      }, { status: 429 });
    }

    const result = await getRecommendations(supabase, user.id, limit, filters);

    // Resolve storage paths to signed URLs for pool photos
    if (result.candidates?.length) {
      const serviceSupabase = await createServiceSupabase();
      for (const candidate of result.candidates) {
        if (candidate.photo_url) {
          const { data } = await serviceSupabase.storage
            .from("pool-photos")
            .createSignedUrl(candidate.photo_url, 3600); // 1 hour
          candidate.photo_url = data?.signedUrl ?? null;
        }
      }
    }

    // Decrement daily recos
    if (entitlement) {
      await supabase
        .from("entitlements")
        .update({ daily_recos_left: Math.max(0, entitlement.daily_recos_left - 1) })
        .eq("user_id", user.id);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
  }
}
