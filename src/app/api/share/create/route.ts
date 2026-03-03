import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createShareToken } from "@/lib/share";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from("persona_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const result = await createShareToken(supabase, user.id, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Share create error:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
