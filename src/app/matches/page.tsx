"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonymousAuth } from "@/lib/auth";

interface MatchedContact {
  id: string;
  from_user: string;
  to_user: string;
  created_at: string;
  partner_id: string;
  partner_name: string | null;
  partner_zodiac: string | null;
}

export default function MatchesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchedContact[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const initRef = useRef(false);
  const init = useCallback(async () => {
    setAuthError(null);
    setLoading(true);
    try {
      await ensureAnonymousAuth();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get all accepted contact requests where user is involved
      const { data: requests } = await supabase
        .from("contact_requests")
        .select("id, from_user, to_user, created_at")
        .eq("status", "accepted")
        .or(`from_user.eq.${user.id},to_user.eq.${user.id}`);

      if (!requests || requests.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      // Get unique partner IDs
      const partnerIds = [
        ...new Set(
          requests.map((r) =>
            r.from_user === user.id ? r.to_user : r.from_user,
          ),
        ),
      ];

      // Fetch partner profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, zodiac")
        .in("id", partnerIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p]),
      );

      // Deduplicate by partner_id (there may be two rows per match)
      const seen = new Set<string>();
      const enriched: MatchedContact[] = [];
      for (const r of requests) {
        const partnerId =
          r.from_user === user.id ? r.to_user : r.from_user;
        if (seen.has(partnerId)) continue;
        seen.add(partnerId);
        const profile = profileMap.get(partnerId);
        enriched.push({
          ...r,
          partner_id: partnerId,
          partner_name: profile?.display_name ?? null,
          partner_zodiac: profile?.zodiac ?? null,
        });
      }

      setMatches(enriched);
    } catch (e) {
      console.error("Matches load error:", e);
      setAuthError(
        e instanceof Error
          ? e.message
          : "Failed to load matches.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      init();
    }
  }, [init]);

  if (authError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface p-6">
        <div className="max-w-sm rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <h2 className="text-lg font-semibold text-red-400">Error</h2>
          <p className="mt-2 text-sm text-red-300/70">{authError}</p>
          <button
            onClick={init}
            className="mt-6 rounded-xl bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="flex gap-1">
          <div className="typing-dot h-3 w-3 rounded-full bg-primary" />
          <div className="typing-dot h-3 w-3 rounded-full bg-primary" />
          <div className="typing-dot h-3 w-3 rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-10 border-b border-surface-lighter bg-surface/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text">My Matches</h1>
            <p className="text-xs text-text-muted">
              {matches.length} mutual{" "}
              {matches.length === 1 ? "match" : "matches"}
            </p>
          </div>
          <button
            onClick={() => router.push("/discover")}
            className="rounded-lg bg-surface-light px-3 py-1.5 text-sm text-text-muted hover:text-text"
          >
            Discover
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {matches.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 text-5xl">&#128149;</div>
            <p className="text-lg text-text-muted">No matches yet</p>
            <p className="mt-1 text-sm text-text-muted/70">
              Like someone in Discover — if they like you back, they will appear
              here!
            </p>
            <button
              onClick={() => router.push("/discover")}
              className="mt-6 rounded-xl bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Go to Discover
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <div
                key={m.partner_id}
                className="flex items-center gap-4 rounded-2xl border border-surface-lighter bg-surface-light p-4"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-2xl">
                  &#128100;
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text">
                    {m.partner_name || "Anonymous"}
                  </h3>
                  <div className="mt-1 flex gap-2">
                    {m.partner_zodiac && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary-light">
                        {m.partner_zodiac}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      Matched{" "}
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                  Matched
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
