import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { resolveShareToken } from "@/lib/share";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const serviceSupabase = await createServiceSupabase();
    const result = await resolveShareToken(serviceSupabase, token);

    if (!result) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    if (!result.valid) {
      return NextResponse.json({ error: "Share link expired" }, { status: 410 });
    }

    return NextResponse.json(result.session);
  } catch (error) {
    console.error("Share resolve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
