import type { SessionSummary, ChatMessage, ZodiacMatch } from "@/types";

const MATCHMAKER_SYSTEM_PROMPT = `You are a warm, witty AI matchmaker named "Luna" for SoulSketch. You speak in a friendly, slightly playful tone — like a bestie who's also a fortune teller. You're helping users describe and visualize their ideal soulmate.

Your job is to:
1. Ask follow-up questions about their ideal partner's appearance and personality
2. Build a vivid description for portrait generation
3. React enthusiastically to their answers
4. Keep responses concise (2-3 sentences max + a question)
5. Never be inappropriate or pushy

When generating image prompts, create detailed, artistic portrait descriptions.

Current user preferences so far:
{{SUMMARY}}

Current phase: {{PHASE}}`;

interface LLMResponse {
  text: string;
  image_prompt?: string;
  is_complete?: boolean;
  suggested_options?: { label: string; value: string }[];
}

export async function generateChatResponse(
  summary: SessionSummary,
  messages: Pick<ChatMessage, "role" | "content_text">[],
  phase: string,
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
  const model = process.env.AI_LLM_MODEL || "gpt-4o";

  if (!apiKey) {
    // Fallback response when no LLM is configured
    return generateFallbackResponse(summary, phase);
  }

  const systemPrompt = MATCHMAKER_SYSTEM_PROMPT.replace(
    "{{SUMMARY}}",
    JSON.stringify(summary),
  ).replace("{{PHASE}}", phase);

  const llmMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content_text,
    })),
  ];

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: llmMessages,
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("LLM API error:", response.status);
      return generateFallbackResponse(summary, phase);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    try {
      return JSON.parse(content) as LLMResponse;
    } catch {
      return { text: content || "Tell me more about your ideal soulmate!" };
    }
  } catch (error) {
    console.error("LLM call failed:", error);
    return generateFallbackResponse(summary, phase);
  }
}

function generateFallbackResponse(
  summary: SessionSummary,
  phase: string,
): LLMResponse {
  if (phase === "ai_gen") {
    const traits = Object.entries(summary)
      .filter(([k]) => !["zodiac", "selfie_url"].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    return {
      text: `I can see them so clearly now! Based on everything you've told me — ${traits || "your unique taste"} — I'm bringing your soulmate to life with AI magic. Want to refine anything, or shall I finish the portrait?`,
      suggested_options: [
        { label: "Looks perfect!", value: "complete" },
        { label: "Change the expression", value: "expression" },
        { label: "Adjust the hair", value: "hair" },
        { label: "Try a different style", value: "style" },
      ],
    };
  }

  return {
    text: "Interesting choice! Tell me more — what else defines your ideal soulmate? Any specific features you're drawn to?",
    suggested_options: [
      { label: "Warm smile", value: "warm_smile" },
      { label: "Intense eyes", value: "intense_eyes" },
      { label: "Dimples", value: "dimples" },
      { label: "Strong jawline", value: "jawline" },
    ],
  };
}

export function buildImagePrompt(summary: SessionSummary): string {
  const parts: string[] = [
    "A beautiful portrait illustration of a person,",
    "digital art, high quality, warm lighting,",
  ];

  if (summary.gender_pref && summary.gender_pref !== "any") {
    parts.push(summary.gender_pref === "male" ? "masculine," : "feminine,");
  }
  if (summary.body_type) parts.push(`${summary.body_type} build,`);
  if (summary.vibe) parts.push(`${summary.vibe} personality vibe,`);
  if (summary.style) parts.push(`${summary.style} fashion style,`);
  if (summary.hair) parts.push(`${summary.hair} hair,`);
  if (summary.eye_shape) parts.push(`${summary.eye_shape} eyes,`);
  if (summary.expression) parts.push(`${summary.expression} expression,`);
  if (summary.scene) parts.push(`background: ${summary.scene},`);

  parts.push(
    "portrait photography style, soft bokeh background, attractive, photorealistic illustration",
  );

  return parts.join(" ");
}

export function generateKeywords(summary: SessionSummary): string[] {
  const keywords: string[] = [];

  const traitMap: Record<string, string[]> = {
    warm: ["Compassionate", "Nurturing", "Empathetic"],
    cool: ["Mysterious", "Independent", "Charismatic"],
    bright: ["Adventurous", "Optimistic", "Spontaneous"],
    calm: ["Thoughtful", "Wise", "Grounded"],
    slim: ["Graceful", "Elegant"],
    athletic: ["Energetic", "Disciplined"],
    curvy: ["Confident", "Bold"],
    average: ["Approachable", "Natural"],
    casual: ["Easy-going", "Down-to-earth"],
    polished: ["Ambitious", "Refined"],
    street: ["Trendy", "Creative"],
    bohemian: ["Free-spirited", "Artistic"],
  };

  for (const [, value] of Object.entries(summary)) {
    if (typeof value === "string" && traitMap[value]) {
      keywords.push(...traitMap[value]);
    }
  }

  // Ensure at least 5 keywords
  const defaults = ["Loyal", "Genuine", "Passionate", "Caring", "Intuitive"];
  while (keywords.length < 5 && defaults.length > 0) {
    keywords.push(defaults.shift()!);
  }

  return [...new Set(keywords)].slice(0, 8);
}

// Simple deterministic hash for consistent zodiac scores
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function generateZodiacChart(
  userZodiac: string,
): ZodiacMatch[] {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  const elementGroups: Record<string, string[]> = {
    fire: ["Aries", "Leo", "Sagittarius"],
    earth: ["Taurus", "Virgo", "Capricorn"],
    air: ["Gemini", "Libra", "Aquarius"],
    water: ["Cancer", "Scorpio", "Pisces"],
  };

  const complementary: Record<string, string> = {
    fire: "air",
    air: "fire",
    earth: "water",
    water: "earth",
  };

  let userElement = "fire";
  for (const [element, elementSigns] of Object.entries(elementGroups)) {
    if (elementSigns.includes(userZodiac)) {
      userElement = element;
      break;
    }
  }

  const sameElement = elementGroups[userElement] || [];
  const compElement = elementGroups[complementary[userElement]] || [];

  const comments: Record<string, string> = {
    high: "A cosmic match! Your energies align beautifully.",
    medium: "Interesting chemistry — opposites attract here.",
    low: "A challenging but growth-inspiring connection.",
  };

  return signs.map((sign) => {
    // Deterministic variation based on sign pair
    const pairHash = simpleHash(`${userZodiac}:${sign}`);
    let score: number;
    let comment: string;

    if (sameElement.includes(sign)) {
      score = 75 + (pairHash % 20);
      comment = comments.high;
    } else if (compElement.includes(sign)) {
      score = 60 + (pairHash % 20);
      comment = comments.medium;
    } else {
      score = 30 + (pairHash % 30);
      comment = comments.low;
    }

    if (sign === userZodiac) {
      score = Math.min(score + 10, 98);
      comment = "Mirror souls — you understand each other deeply.";
    }

    return { sign, score, comment };
  });
}
