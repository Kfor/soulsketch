import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generatePortrait } from "@/lib/ai/image-generator";
import { buildImagePrompt } from "@/lib/chat/llm-engine";
import type { SessionSummary } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { session_id } = await request.json();
    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // Check export credits
    const { data: entitlement } = await supabase
      .from("entitlements")
      .select("export_credits")
      .eq("user_id", user.id)
      .single();

    if (!entitlement || entitlement.export_credits <= 0) {
      return NextResponse.json(
        { error: "No export credits remaining. Purchase HD export to unlock." },
        { status: 403 },
      );
    }

    // Validate session belongs to user
    const { data: session } = await supabase
      .from("persona_sessions")
      .select("summary_json")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const summary = (session.summary_json as SessionSummary) ?? {};
    const prompt = buildImagePrompt(summary);

    // Generate HD portrait (higher quality)
    const result = await generatePortrait(
      `${prompt} Ultra high resolution, 4K quality, extremely detailed.`,
    );

    // Deduct one export credit atomically using optimistic concurrency:
    // only update if credits haven't changed since we read them.
    const { data: updated, error: deductError } = await supabase
      .from("entitlements")
      .update({ export_credits: entitlement.export_credits - 1 })
      .eq("user_id", user.id)
      .eq("export_credits", entitlement.export_credits) // guard against race
      .select("export_credits")
      .single();

    if (deductError || !updated) {
      return NextResponse.json(
        { error: "Credit deduction failed. Please try again." },
        { status: 409 },
      );
    }

    // Save generated HD asset record
    await supabase.from("generated_assets").insert({
      session_id,
      user_id: user.id,
      asset_type: "portrait",
      storage_path: result.url,
      is_highres: true,
      version: 1,
    });

    return NextResponse.json({
      url: result.url,
      credits_remaining: updated.export_credits,
    });
  } catch (error) {
    console.error("HD export error:", error);
    return NextResponse.json(
      { error: "HD export failed" },
      { status: 500 },
    );
  }
}
