import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a share link for a completed session.
 */
export async function createShareToken(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
) {
  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("share_links")
    .insert({
      user_id: userId,
      session_id: sessionId,
      token,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    token: data.token,
    url: `${appUrl}/share/${data.token}`,
    expires_at: data.expires_at,
  };
}

/**
 * Resolve a share token to session data (public, no auth needed).
 * Uses service role client to bypass RLS.
 */
export async function resolveShareToken(
  serviceSupabase: SupabaseClient,
  token: string,
): Promise<{
  valid: boolean;
  session?: {
    id: string;
    summary_json: Record<string, unknown>;
    portrait_url?: string;
  };
} | null> {
  const { data: link } = await serviceSupabase
    .from("share_links")
    .select("session_id, expires_at")
    .eq("token", token)
    .limit(1)
    .single();

  if (!link) return null;
  if (new Date(link.expires_at) < new Date()) return { valid: false };

  const { data: session } = await serviceSupabase
    .from("persona_sessions")
    .select("id, summary_json")
    .eq("id", link.session_id)
    .single();

  if (!session) return { valid: false };

  const { data: messages } = await serviceSupabase
    .from("chat_messages")
    .select("content_image_url")
    .eq("session_id", session.id)
    .not("content_image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    valid: true,
    session: {
      id: session.id,
      summary_json: session.summary_json ?? {},
      portrait_url: messages?.[0]?.content_image_url ?? undefined,
    },
  };
}

/**
 * Cryptographically secure share token.
 */
function generateShareToken(): string {
  return randomBytes(9).toString("base64url");
}
