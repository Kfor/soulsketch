import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createInviteCode } from "@/lib/invite";

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const result = await createInviteCode(supabase, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Generate invite error:", error);
    return NextResponse.json({ error: "Failed to generate invite" }, { status: 500 });
  }
}
