import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generatePortrait } from "@/lib/ai/image-generator";
import { buildImagePrompt } from "@/lib/chat/llm-engine";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import type { SessionSummary } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session_id } = await request.json();

    // Validate session
    const { data: session } = await supabase
      .from("persona_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Rate limit check
    const identifier = user.id;
    const rateResult = await checkRateLimit(identifier, "ai_generation");

    if (!rateResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          remaining: rateResult.remaining,
          reset_at: rateResult.resetAt.toISOString(),
        },
        { status: 429 },
      );
    }

    const summary = (session.summary_json as SessionSummary) ?? {};
    const prompt = buildImagePrompt(summary);
    const result = await generatePortrait(prompt);

    // Save generated asset record
    await supabase.from("generated_assets").insert({
      session_id,
      user_id: user.id,
      asset_type: "portrait",
      storage_path: result.url,
      is_highres: false,
      version: 1,
    });

    return NextResponse.json({
      url: result.url,
      revised_prompt: result.revised_prompt,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Image generation failed" },
      { status: 500 },
    );
  }
}
