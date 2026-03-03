import { createServiceSupabase } from "@/lib/supabase/server";

const DEFAULT_WINDOW_MS = 86400000; // 24 hours
const DEFAULT_MAX_REQUESTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  identifier: string,
  actionType: string,
  maxRequests?: number,
): Promise<RateLimitResult> {
  const limit = maxRequests ?? parseInt(process.env.RATE_LIMIT_ANON_GENERATIONS ?? String(DEFAULT_MAX_REQUESTS), 10);
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? String(DEFAULT_WINDOW_MS), 10);
  const supabase = await createServiceSupabase();
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);

  // Use upsert + conditional increment for atomicity.
  // First, try to reset expired windows or create new entries.
  const { data: upserted } = await supabase
    .from("rate_limits")
    .upsert(
      {
        identifier,
        action_type: actionType,
        count: 1,
        window_start: now.toISOString(),
      },
      { onConflict: "identifier,action_type", ignoreDuplicates: true },
    )
    .select()
    .single();

  // If upsert created a new row, we're done
  if (upserted && new Date(upserted.window_start).getTime() === now.getTime()) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  // Otherwise read the existing entry
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("identifier", identifier)
    .eq("action_type", actionType)
    .single();

  if (!existing) {
    // Shouldn't happen after upsert, but handle gracefully
    return { allowed: true, remaining: limit - 1, resetAt: new Date(now.getTime() + windowMs) };
  }

  const windowStart = new Date(existing.window_start);
  const windowEnd = new Date(windowStart.getTime() + windowMs);

  // Window expired — reset
  if (windowStart < windowCutoff) {
    await supabase
      .from("rate_limits")
      .update({ count: 1, window_start: now.toISOString() })
      .eq("id", existing.id);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  // Over limit
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: windowEnd };
  }

  // Atomic increment with guard: only increment if count hasn't changed
  const { data: updated } = await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("id", existing.id)
    .eq("count", existing.count) // optimistic concurrency guard
    .select()
    .single();

  if (!updated) {
    // Another request won the race — re-check
    return checkRateLimit(identifier, actionType, maxRequests);
  }

  return {
    allowed: true,
    remaining: limit - updated.count,
    resetAt: windowEnd,
  };
}
