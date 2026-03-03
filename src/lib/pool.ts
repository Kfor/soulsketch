import type { SupabaseClient } from "@supabase/supabase-js";

export async function joinPool(
  supabase: SupabaseClient,
  userId: string,
  data: {
    zodiac: string;
    age_bucket: string;
    city: string;
    gender_pref: string;
    display_name?: string;
  }
) {
  // Update profile with pool info
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_in_pool: true,
      zodiac: data.zodiac,
      age_bucket: data.age_bucket,
      city: data.city,
      gender_pref: data.gender_pref,
      display_name: data.display_name || null,
    })
    .eq("id", userId);

  if (profileError) throw profileError;
  return { success: true };
}

export async function uploadPoolPhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File
) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("pool-photos")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  // Save record
  const { error: recordError } = await supabase
    .from("pool_photos")
    .insert({ user_id: userId, storage_path: path });

  if (recordError) throw recordError;
  return { path };
}

export async function getRecommendations(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  filters?: {
    age_bucket?: string;
    city?: string;
    zodiac?: string;
    gender_pref?: string;
  }
) {
  // Get user's latest completed session for embedding
  const { data: session } = await supabase
    .from("persona_sessions")
    .select("pref_embedding")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!session?.pref_embedding) {
    return { candidates: [], error: "No preference data found. Complete a chat session first." };
  }

  // Call SECURITY DEFINER RPC
  const { data, error } = await supabase.rpc("search_pool_candidates", {
    query_embedding: session.pref_embedding,
    match_count: limit,
    filter_age_bucket: filters?.age_bucket || null,
    filter_city: filters?.city || null,
    filter_zodiac: filters?.zodiac || null,
    filter_gender_pref: filters?.gender_pref || null,
  });

  if (error) throw error;

  // Log search
  await supabase.from("search_logs").insert({
    user_id: userId,
    query_type: "pool_recommendation",
  });

  return { candidates: data || [] };
}

export async function sendLike(
  supabase: SupabaseClient,
  fromUser: string,
  toUser: string
) {
  // Check for existing request
  const { data: existing } = await supabase
    .from("contact_requests")
    .select("id, status")
    .eq("from_user", fromUser)
    .eq("to_user", toUser)
    .single();

  if (existing) {
    return { alreadySent: true, status: existing.status };
  }

  // Insert the like
  const { error } = await supabase.from("contact_requests").insert({
    from_user: fromUser,
    to_user: toUser,
    status: "pending",
  });

  if (error) throw error;

  // Check if mutual (the other person already liked us)
  const { data: mutual } = await supabase
    .from("contact_requests")
    .select("id")
    .eq("from_user", toUser)
    .eq("to_user", fromUser)
    .eq("status", "pending")
    .single();

  if (mutual) {
    // Dual-Like: accept both
    await supabase
      .from("contact_requests")
      .update({ status: "accepted" })
      .eq("from_user", toUser)
      .eq("to_user", fromUser);

    await supabase
      .from("contact_requests")
      .update({ status: "accepted" })
      .eq("from_user", fromUser)
      .eq("to_user", toUser);

    return { matched: true };
  }

  return { sent: true };
}

export async function leavePool(
  supabase: SupabaseClient,
  userId: string
) {
  // Remove from pool
  await supabase
    .from("profiles")
    .update({ is_in_pool: false })
    .eq("id", userId);

  // Delete all pool photos (hard delete per security requirement)
  const { data: photos } = await supabase
    .from("pool_photos")
    .select("storage_path")
    .eq("user_id", userId);

  if (photos) {
    const paths = photos.map((p) => p.storage_path);
    if (paths.length > 0) {
      await supabase.storage.from("pool-photos").remove(paths);
    }
    await supabase.from("pool_photos").delete().eq("user_id", userId);
  }

  return { success: true };
}
