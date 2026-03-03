import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getInviteStatus } from "@/lib/invite";

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const status = await getInviteStatus(supabase, user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Invite status error:", error);
    return NextResponse.json({ error: "Failed to get invite status" }, { status: 500 });
  }
}
