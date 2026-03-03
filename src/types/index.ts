export type SessionPhase =
  | "sketch"
  | "ai_gen"
  | "calibration"
  | "done";

export type SessionStatus = "active" | "completed";

export type SketchLevel =
  | "outline"
  | "simple"
  | "detailed"
  | "ai_v1"
  | "ai_v2"
  | "ai_v3";

export type MessageRole = "system" | "assistant" | "user";

export type AssetType = "portrait" | "keyword_card" | "zodiac_card";

export type ContactStatus = "pending" | "accepted" | "rejected" | "blocked";

export type Plan = "free" | "plus";

export interface Profile {
  id: string;
  display_name: string | null;
  gender_pref: string | null;
  age_bucket: string | null;
  city: string | null;
  zodiac: string | null;
  is_in_pool: boolean;
  visibility_level: string;
  created_at: string;
}

export interface Entitlement {
  user_id: string;
  plan: Plan;
  plan_expires_at: string | null;
  export_credits: number;
  search_daily_limit: number;
  contact_daily_limit: number;
  daily_draws_left: number;
  daily_recos_left: number;
}

export interface PersonaSession {
  id: string;
  user_id: string;
  status: SessionStatus;
  current_phase: SessionPhase;
  summary_json: Record<string, unknown> | null;
  pref_embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content_text: string;
  content_options: OptionItem[] | null;
  content_image_url: string | null;
  sketch_level: SketchLevel | null;
  created_at: string;
}

export interface OptionItem {
  label: string;
  value: string;
  image_url?: string;
}

export interface SketchAsset {
  id: string;
  tags: Record<string, string>;
  detail_level: "outline" | "simple" | "detailed";
  storage_path: string;
  created_at: string;
}

export interface GeneratedAsset {
  id: string;
  session_id: string;
  user_id: string;
  asset_type: AssetType;
  storage_path: string;
  is_highres: boolean;
  version: number;
  created_at: string;
}

export interface QuestionNode {
  id: string;
  round: number;
  question_text: string;
  options: OptionItem[];
  sketch_tag_mapping: Record<string, Record<string, string>>;
  next_node_mapping: Record<string, string>;
  detail_level: "outline" | "simple" | "detailed";
}

export interface SessionSummary {
  gender_pref?: string;
  body_type?: string;
  vibe?: string;
  style?: string;
  hair?: string;
  eye_shape?: string;
  expression?: string;
  scene?: string;
  zodiac?: string;
  selfie_url?: string;
  [key: string]: unknown;
}

export interface ResultCards {
  portrait_url: string;
  keywords: string[];
  zodiac_chart: ZodiacMatch[];
}

export interface ZodiacMatch {
  sign: string;
  score: number;
  comment: string;
}
