import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { redeemInviteCode } from "@/lib/invite";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    // Use service role for the redeem operation (needs to update inviter's data)
    const serviceSupabase = await createServiceSupabase();
    const result = await redeemInviteCode(serviceSupabase, code, user.id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Redeem invite error:", error);
    return NextResponse.json({ error: "Failed to redeem invite" }, { status: 500 });
  }
}
