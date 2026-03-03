import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendLike } from "@/lib/pool";

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

    const result = await sendLike(supabase, user.id, targetUserId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "Failed to send like" }, { status: 500 });
  }
}
