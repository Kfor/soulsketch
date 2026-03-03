import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceSupabase,
} from "@/lib/supabase/server";

/**
 * POST /api/auth/migrate
 * Migrate data from anonymous user to newly linked real user.
 * Body: { anon_user_id: string }
 *
 * The caller must be authenticated as the real (non-anonymous) user.
 * The anon_user_id must belong to a verified anonymous user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user || user.is_anonymous) {
      return NextResponse.json(
        { error: "Must be authenticated as a non-anonymous user" },
        { status: 401 },
      );
    }

    const real_user_id = user.id;
    const { anon_user_id } = await request.json();

    if (!anon_user_id || anon_user_id === real_user_id) {
      return NextResponse.json(
        { error: "Invalid anonymous user ID" },
        { status: 400 },
      );
    }

    const supabase = await createServiceSupabase();

    // Verify anon_user_id is actually an anonymous user
    const { data: anonUser } = await supabase.auth.admin.getUserById(
      anon_user_id,
    );
    if (!anonUser?.user?.is_anonymous) {
      return NextResponse.json(
        { error: "Provided ID is not an anonymous user" },
        { status: 403 },
      );
    }

    // Migrate persona_sessions
    await supabase
      .from("persona_sessions")
      .update({ user_id: real_user_id })
      .eq("user_id", anon_user_id);

    // Migrate generated_assets
    await supabase
      .from("generated_assets")
      .update({ user_id: real_user_id })
      .eq("user_id", anon_user_id);

    // Migrate profile data (merge, don't overwrite)
    const { data: anonProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", anon_user_id)
      .single();

    if (anonProfile) {
      const updateFields: Record<string, unknown> = {};
      if (anonProfile.gender_pref)
        updateFields.gender_pref = anonProfile.gender_pref;
      if (anonProfile.zodiac) updateFields.zodiac = anonProfile.zodiac;
      if (anonProfile.age_bucket)
        updateFields.age_bucket = anonProfile.age_bucket;

      if (Object.keys(updateFields).length > 0) {
        await supabase
          .from("profiles")
          .update(updateFields)
          .eq("id", real_user_id);
      }
    }

    // Migrate entitlements (carry over credits)
    const { data: anonEntitlements } = await supabase
      .from("entitlements")
      .select("*")
      .eq("user_id", anon_user_id)
      .single();

    if (anonEntitlements && anonEntitlements.export_credits > 0) {
      await supabase
        .from("entitlements")
        .update({ export_credits: anonEntitlements.export_credits })
        .eq("user_id", real_user_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 },
    );
  }
}
