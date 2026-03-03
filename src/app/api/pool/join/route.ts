import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { joinPool } from "@/lib/pool";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const zodiac = formData.get("zodiac") as string;
    const age_bucket = formData.get("age_bucket") as string;
    const city = formData.get("city") as string;
    const gender_pref = formData.get("gender_pref") as string;
    const display_name = formData.get("display_name") as string | null;
    const photo = formData.get("photo") as File | null;

    if (!zodiac || !age_bucket || !city || !gender_pref) {
      return NextResponse.json(
        { error: "Missing required fields: zodiac, age_bucket, city, gender_pref" },
        { status: 400 }
      );
    }

    // Upload photo if provided
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (photo && photo.size > 0) {
      if (photo.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Photo must be under 5MB" }, { status: 400 });
      }
      if (!ALLOWED_TYPES.includes(photo.type)) {
        return NextResponse.json({ error: "Only JPEG, PNG, and WebP images allowed" }, { status: 400 });
      }
      const ext = photo.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("pool-photos")
        .upload(path, photo, { contentType: photo.type, upsert: false });

      if (uploadError) {
        console.error("Photo upload error:", uploadError);
        // Continue without photo — not blocking
      } else {
        await supabase.from("pool_photos").insert({
          user_id: user.id,
          storage_path: path,
        });
      }
    }

    const result = await joinPool(supabase, user.id, {
      zodiac,
      age_bucket,
      city,
      gender_pref,
      display_name: display_name || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Pool join error:", error);
    return NextResponse.json({ error: "Failed to join pool" }, { status: 500 });
  }
}
