import type { QuestionNode, OptionItem } from "@/types";

/**
 * Question Graph for the first ~5 rounds of the chat.
 * Each node maps to a question with options and sketch tag mappings.
 * After answering, the next node is determined by the user's choice.
 */

const QUESTION_GRAPH: Record<string, QuestionNode> = {
  q1_gender: {
    id: "q1_gender",
    round: 1,
    question_text:
      "Hey there! I'm your matchmaker today. Let's start painting your soulmate! First things first — who are you looking for?",
    options: [
      { label: "A man", value: "male" },
      { label: "A woman", value: "female" },
      { label: "Either / surprise me", value: "any" },
    ],
    sketch_tag_mapping: {
      male: { gender_pref: "male" },
      female: { gender_pref: "female" },
      any: { gender_pref: "any" },
    },
    next_node_mapping: {
      male: "q2_body_type",
      female: "q2_body_type",
      any: "q2_body_type",
    },
    detail_level: "outline",
  },

  q2_body_type: {
    id: "q2_body_type",
    round: 2,
    question_text:
      "Nice! Now I'm sketching the outline... What kind of build catches your eye?",
    options: [
      { label: "Slim & lean", value: "slim" },
      { label: "Athletic & toned", value: "athletic" },
      { label: "Curvy / muscular", value: "curvy" },
      { label: "Average / natural", value: "average" },
    ],
    sketch_tag_mapping: {
      slim: { body_type: "slim" },
      athletic: { body_type: "athletic" },
      curvy: { body_type: "curvy" },
      average: { body_type: "average" },
    },
    next_node_mapping: {
      slim: "q3_vibe",
      athletic: "q3_vibe",
      curvy: "q3_vibe",
      average: "q3_vibe",
    },
    detail_level: "outline",
  },

  q3_vibe: {
    id: "q3_vibe",
    round: 3,
    question_text:
      "The silhouette is taking shape! What kind of vibe does your soulmate give off?",
    options: [
      { label: "Warm & gentle", value: "warm" },
      { label: "Cool & mysterious", value: "cool" },
      { label: "Bright & energetic", value: "bright" },
      { label: "Calm & intellectual", value: "calm" },
    ],
    sketch_tag_mapping: {
      warm: { vibe: "warm" },
      cool: { vibe: "cool" },
      bright: { vibe: "bright" },
      calm: { vibe: "calm" },
    },
    next_node_mapping: {
      warm: "q4_style",
      cool: "q4_style",
      bright: "q4_style",
      calm: "q4_style",
    },
    detail_level: "simple",
  },

  q4_style: {
    id: "q4_style",
    round: 4,
    question_text:
      "Looking good! I can see them more clearly now. How does your ideal person dress?",
    options: [
      { label: "Casual & effortless", value: "casual" },
      { label: "Sharp & polished", value: "polished" },
      { label: "Streetwear / trendy", value: "street" },
      { label: "Artistic / bohemian", value: "bohemian" },
    ],
    sketch_tag_mapping: {
      casual: { style: "casual" },
      polished: { style: "polished" },
      street: { style: "street" },
      bohemian: { style: "bohemian" },
    },
    next_node_mapping: {
      casual: "q5_hair",
      polished: "q5_hair",
      street: "q5_hair",
      bohemian: "q5_hair",
    },
    detail_level: "simple",
  },

  q5_hair: {
    id: "q5_hair",
    round: 5,
    question_text:
      "Almost done with the sketch phase! What kind of hair are you drawn to?",
    options: [
      { label: "Short & neat", value: "short" },
      { label: "Medium & flowing", value: "medium" },
      { label: "Long & free", value: "long" },
      { label: "Curly / textured", value: "curly" },
    ],
    sketch_tag_mapping: {
      short: { hair: "short" },
      medium: { hair: "medium" },
      long: { hair: "long" },
      curly: { hair: "curly" },
    },
    next_node_mapping: {
      short: "__ai_gen__",
      medium: "__ai_gen__",
      long: "__ai_gen__",
      curly: "__ai_gen__",
    },
    detail_level: "detailed",
  },
};

const START_NODE = "q1_gender";

export function getStartNode(): QuestionNode {
  return QUESTION_GRAPH[START_NODE];
}

export function getNode(id: string): QuestionNode | undefined {
  return QUESTION_GRAPH[id];
}

export function getNextNodeId(
  currentNodeId: string,
  selectedValue: string,
): string | null {
  const node = QUESTION_GRAPH[currentNodeId];
  if (!node) return null;
  return node.next_node_mapping[selectedValue] ?? null;
}

export function isTerminalNode(nextNodeId: string): boolean {
  return nextNodeId === "__ai_gen__";
}

export function getSketchTags(
  nodeId: string,
  selectedValue: string,
): Record<string, string> {
  const node = QUESTION_GRAPH[nodeId];
  if (!node) return {};
  return node.sketch_tag_mapping[selectedValue] ?? {};
}

/**
 * Select the best matching sketch asset path based on accumulated tags.
 * In production, this would query the sketch_assets table.
 * For now, returns a placeholder SVG path based on tags.
 */
export function selectSketchAsset(
  tags: Record<string, unknown>,
  detailLevel: "outline" | "simple" | "detailed",
): string {
  // Generate a deterministic placeholder based on tags
  const gender = (tags.gender_pref as string) ?? "any";
  return `/sketches/${detailLevel}_${gender}.svg`;
}

export function resolveUserInput(
  nodeId: string,
  userText: string,
): string | null {
  const node = QUESTION_GRAPH[nodeId];
  if (!node) return null;

  const lower = userText.toLowerCase().trim();

  // Try to match against option labels/values
  for (const opt of node.options) {
    if (
      lower.includes(opt.value.toLowerCase()) ||
      lower.includes(opt.label.toLowerCase())
    ) {
      return opt.value;
    }
  }

  // Default to first option if no match (LLM could do better matching)
  return node.options[0]?.value ?? null;
}
