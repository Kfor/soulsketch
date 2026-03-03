import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceSupabase();
    const { data, error } = await supabase.rpc("get_pool_count");

    if (error) throw error;

    const stats = data?.[0] ?? { pool_members: 0, sketches_created: 0 };
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Pool count error:", error);
    return NextResponse.json({ pool_members: 0, sketches_created: 0 });
  }
}
