import type { SupabaseClient } from "@supabase/supabase-js";

const REWARD_LADDER = [
  { count: 1, reward: "no_watermark", label: "Watermark-free export" },
  { count: 2, reward: "hd_export", label: "HD export unlock" },
  { count: 3, reward: "extra_versions", label: "3 new portrait versions" },
] as const;

export function getRewardForCount(count: number) {
  return REWARD_LADDER.filter((r) => count >= r.count);
}

export async function createInviteCode(
  supabase: SupabaseClient,
  userId: string
) {
  const code = generateShortCode();
  const { data, error } = await supabase
    .from("invites")
    .insert({ inviter_id: userId, code })
    .select()
    .single();

  if (error) throw error;
  return { code: data.code, id: data.id };
}

export async function redeemInviteCode(
  supabase: SupabaseClient,
  code: string,
  inviteeId: string
) {
  // Use SECURITY DEFINER RPC to look up invite
  const { data: invites, error: lookupError } = await supabase.rpc(
    "lookup_invite_code",
    { invite_code: code }
  );

  if (lookupError) throw lookupError;
  if (!invites || invites.length === 0) {
    return { error: "Invalid or expired invite code" };
  }

  const invite = invites[0];

  // Prevent self-invite
  if (invite.inviter_id === inviteeId) {
    return { error: "Cannot use your own invite code" };
  }

  // Mark invite as used (service role needed to bypass RLS)
  const { error: updateError } = await supabase
    .from("invites")
    .update({ invitee_id: inviteeId, is_valid: false })
    .eq("id", invite.id);

  if (updateError) throw updateError;

  // Count total successful invites for the inviter
  const { count } = await supabase
    .from("invites")
    .select("*", { count: "exact", head: true })
    .eq("inviter_id", invite.inviter_id)
    .not("invitee_id", "is", null);

  const inviteCount = count ?? 0;
  const rewards = getRewardForCount(inviteCount);

  // Apply rewards to inviter's entitlements
  if (inviteCount >= 1) {
    const updates: Record<string, unknown> = {};
    if (inviteCount >= 1) updates.export_credits = inviteCount; // watermark-free
    if (inviteCount >= 3) updates.daily_draws_left = 8; // extra versions

    await supabase
      .from("entitlements")
      .update(updates)
      .eq("user_id", invite.inviter_id);
  }

  return {
    success: true,
    inviter_rewards: rewards,
    invite_count: inviteCount,
  };
}

export async function getInviteStatus(
  supabase: SupabaseClient,
  userId: string
) {
  const { data: invites } = await supabase
    .from("invites")
    .select("id, code, invitee_id, is_valid, created_at")
    .eq("inviter_id", userId)
    .order("created_at", { ascending: false });

  const total = invites?.length ?? 0;
  const redeemed = invites?.filter((i) => i.invitee_id !== null).length ?? 0;
  const rewards = getRewardForCount(redeemed);

  return {
    invites: invites ?? [],
    total,
    redeemed,
    rewards,
    next_reward:
      redeemed < REWARD_LADDER.length
        ? REWARD_LADDER[redeemed]
        : null,
  };
}

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
