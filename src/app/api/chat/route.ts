import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateChatResponse, buildImagePrompt } from "@/lib/chat/llm-engine";
import { generatePortrait } from "@/lib/ai/image-generator";
import {
  getNode,
  getNextNodeId,
  isTerminalNode,
  getSketchTags,
  selectSketchAsset,
  resolveUserInput,
} from "@/lib/chat/question-graph";
import { moderateText } from "@/lib/security/content-moderator";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import type { SessionSummary, ChatMessage } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      session_id,
      user_message,
      selected_option,
      current_node_id,
    }: {
      session_id: string;
      user_message?: string;
      selected_option?: string;
      current_node_id?: string;
    } = body;

    // Validate session belongs to user
    const { data: session } = await supabase
      .from("persona_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messageText = user_message || selected_option || "";

    // Content moderation
    if (messageText) {
      const modResult = moderateText(messageText);
      if (!modResult.passed) {
        return NextResponse.json(
          { error: modResult.reason },
          { status: 422 },
        );
      }
    }

    // Save user message
    if (messageText) {
      await supabase.from("chat_messages").insert({
        session_id,
        role: "user",
        content_text: messageText,
      });
    }

    const summary: SessionSummary = (session.summary_json as SessionSummary) ?? {};
    const phase = session.current_phase;

    // =============================================
    // SKETCH PHASE (Question Graph driven)
    // =============================================
    if (phase === "sketch" && current_node_id) {
      const currentNode = getNode(current_node_id);
      const selectedValue = selected_option
        ? selected_option
        : messageText
          ? resolveUserInput(current_node_id, messageText)
          : null;

      if (currentNode && selectedValue) {
        // Update summary with new tags
        const tags = getSketchTags(current_node_id, selectedValue);
        const updatedSummary = { ...summary, ...tags };

        const nextNodeId = getNextNodeId(current_node_id, selectedValue);

        if (nextNodeId && isTerminalNode(nextNodeId)) {
          // Transition to AI generation phase
          await supabase
            .from("persona_sessions")
            .update({
              current_phase: "ai_gen",
              summary_json: updatedSummary,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session_id);

          // Rate limit check for AI generation
          const identifier = user.id;
          const rateResult = await checkRateLimit(
            identifier,
            "ai_generation",
          );

          let imageUrl: string | undefined;
          if (rateResult.allowed) {
            const prompt = buildImagePrompt(updatedSummary);
            const result = await generatePortrait(prompt);
            imageUrl = result.url;
          }

          const assistantMessage = {
            session_id,
            role: "assistant" as const,
            content_text:
              "The sketch is complete! Now let me bring your soulmate to life with AI magic... Here's the first portrait! What do you think — want to refine anything?",
            content_options: JSON.stringify([
              { label: "Looks great!", value: "complete" },
              { label: "Adjust the look", value: "adjust" },
              { label: "Try a different style", value: "restyle" },
            ]),
            content_image_url: imageUrl ?? null,
            sketch_level: "ai_v1" as const,
          };

          const { data: saved } = await supabase
            .from("chat_messages")
            .insert(assistantMessage)
            .select()
            .single();

          return NextResponse.json({
            message: saved,
            phase: "ai_gen",
            next_node_id: null,
            summary: updatedSummary,
          });
        }

        // Continue in sketch phase
        if (nextNodeId) {
          const nextNode = getNode(nextNodeId);
          if (nextNode) {
            await supabase
              .from("persona_sessions")
              .update({
                summary_json: updatedSummary,
                updated_at: new Date().toISOString(),
              })
              .eq("id", session_id);

            const sketchUrl = selectSketchAsset(
              updatedSummary,
              nextNode.detail_level,
            );

            const assistantMessage = {
              session_id,
              role: "assistant" as const,
              content_text: nextNode.question_text,
              content_options: JSON.stringify(nextNode.options),
              content_image_url: sketchUrl,
              sketch_level: nextNode.detail_level,
            };

            const { data: saved } = await supabase
              .from("chat_messages")
              .insert(assistantMessage)
              .select()
              .single();

            return NextResponse.json({
              message: saved,
              phase: "sketch",
              next_node_id: nextNodeId,
              summary: updatedSummary,
            });
          }
        }
      }
    }

    // =============================================
    // AI GENERATION PHASE (LLM driven)
    // =============================================
    if (phase === "ai_gen") {
      // Check if user wants to complete
      if (
        selected_option === "complete" ||
        messageText.toLowerCase().includes("perfect") ||
        messageText.toLowerCase().includes("done") ||
        messageText.toLowerCase().includes("finish")
      ) {
        // Move to calibration phase
        await supabase
          .from("persona_sessions")
          .update({
            current_phase: "calibration",
            updated_at: new Date().toISOString(),
          })
          .eq("id", session_id);

        const assistantMessage = {
          session_id,
          role: "assistant" as const,
          content_text:
            "Your soulmate portrait is ready! Just one more step — let's calibrate the cosmic connection. What's your zodiac sign? This helps me fine-tune the compatibility analysis.",
          content_options: JSON.stringify([
            { label: "Aries", value: "Aries" },
            { label: "Taurus", value: "Taurus" },
            { label: "Gemini", value: "Gemini" },
            { label: "Cancer", value: "Cancer" },
            { label: "Leo", value: "Leo" },
            { label: "Virgo", value: "Virgo" },
            { label: "Libra", value: "Libra" },
            { label: "Scorpio", value: "Scorpio" },
            { label: "Sagittarius", value: "Sagittarius" },
            { label: "Capricorn", value: "Capricorn" },
            { label: "Aquarius", value: "Aquarius" },
            { label: "Pisces", value: "Pisces" },
          ]),
          content_image_url: null,
          sketch_level: null,
        };

        const { data: saved } = await supabase
          .from("chat_messages")
          .insert(assistantMessage)
          .select()
          .single();

        return NextResponse.json({
          message: saved,
          phase: "calibration",
          next_node_id: null,
          summary,
        });
      }

      // Continue AI gen refinement
      const identifier =
        request.headers.get("x-forwarded-for") || user.id;
      const rateResult = await checkRateLimit(identifier, "ai_generation");

      if (!rateResult.allowed) {
        const assistantMessage = {
          session_id,
          role: "assistant" as const,
          content_text: `You've reached the daily generation limit. Come back tomorrow for more! (Resets at ${rateResult.resetAt.toLocaleTimeString()})`,
          content_options: JSON.stringify([
            { label: "Finish with current portrait", value: "complete" },
          ]),
          content_image_url: null,
          sketch_level: null,
        };

        const { data: saved } = await supabase
          .from("chat_messages")
          .insert(assistantMessage)
          .select()
          .single();

        return NextResponse.json({
          message: saved,
          phase: "ai_gen",
          next_node_id: null,
          summary,
        });
      }

      // Update summary with user's refinement
      if (messageText) {
        const lower = messageText.toLowerCase();
        if (lower.includes("hair")) summary.hair = messageText;
        else if (lower.includes("eye")) summary.eye_shape = messageText;
        else if (lower.includes("expression") || lower.includes("smile"))
          summary.expression = messageText;
        else if (lower.includes("style")) summary.style = messageText;
      }

      // Get LLM response with context
      const { data: recentMessages } = await supabase
        .from("chat_messages")
        .select("role, content_text")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true })
        .limit(20);

      const llmResponse = await generateChatResponse(
        summary,
        (recentMessages ?? []) as Pick<ChatMessage, "role" | "content_text">[],
        "ai_gen",
      );

      // Generate refined portrait
      const prompt = buildImagePrompt(summary);
      const imageResult = await generatePortrait(prompt);

      await supabase
        .from("persona_sessions")
        .update({
          summary_json: summary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session_id);

      const assistantMessage = {
        session_id,
        role: "assistant" as const,
        content_text: llmResponse.text,
        content_options: llmResponse.suggested_options
          ? JSON.stringify(llmResponse.suggested_options)
          : JSON.stringify([
              { label: "Looks perfect!", value: "complete" },
              { label: "Keep refining", value: "refine" },
            ]),
        content_image_url: imageResult.url,
        sketch_level: "ai_v2" as const,
      };

      const { data: saved } = await supabase
        .from("chat_messages")
        .insert(assistantMessage)
        .select()
        .single();

      return NextResponse.json({
        message: saved,
        phase: "ai_gen",
        next_node_id: null,
        summary,
      });
    }

    // =============================================
    // CALIBRATION PHASE
    // =============================================
    if (phase === "calibration") {
      const zodiacSigns = [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
      ];

      const selectedZodiac =
        zodiacSigns.find(
          (s) => s.toLowerCase() === (selected_option || messageText).toLowerCase(),
        ) ?? null;

      if (selectedZodiac) {
        const updatedSummary = { ...summary, zodiac: selectedZodiac };

        await supabase
          .from("persona_sessions")
          .update({
            current_phase: "done",
            status: "completed",
            summary_json: updatedSummary,
            updated_at: new Date().toISOString(),
          })
          .eq("id", session_id);

        // Update user profile with zodiac
        await supabase
          .from("profiles")
          .update({ zodiac: selectedZodiac })
          .eq("id", user.id);

        const assistantMessage = {
          session_id,
          role: "assistant" as const,
          content_text: `${selectedZodiac}! The stars are aligned. Your soulmate portrait and cosmic reading are ready! Here are your three result cards.`,
          content_options: null,
          content_image_url: null,
          sketch_level: null,
        };

        const { data: saved } = await supabase
          .from("chat_messages")
          .insert(assistantMessage)
          .select()
          .single();

        return NextResponse.json({
          message: saved,
          phase: "done",
          next_node_id: null,
          summary: updatedSummary,
          show_results: true,
        });
      }

      // Ask for selfie (optional)
      const assistantMessage = {
        session_id,
        role: "assistant" as const,
        content_text:
          "I didn't catch your zodiac sign. Please select one from the options below!",
        content_options: JSON.stringify(
          zodiacSigns.map((s) => ({ label: s, value: s })),
        ),
        content_image_url: null,
        sketch_level: null,
      };

      const { data: saved } = await supabase
        .from("chat_messages")
        .insert(assistantMessage)
        .select()
        .single();

      return NextResponse.json({
        message: saved,
        phase: "calibration",
        next_node_id: null,
        summary,
      });
    }

    // Default fallback
    return NextResponse.json(
      { error: "Invalid state" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
