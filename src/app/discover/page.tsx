"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonymousAuth } from "@/lib/auth";

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

interface Candidate {
  user_id: string;
  display_name: string | null;
  age_bucket: string | null;
  city: string | null;
  zodiac: string | null;
  gender_pref: string | null;
  similarity: number;
  photo_url: string | null;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<{
    age_bucket?: string;
    city?: string;
    zodiac?: string;
    gender_pref?: string;
  }>({});

  useEffect(() => {
    async function init() {
      try {
        await ensureAnonymousAuth();
        const supabase = createClient();
        const { data: { user: u } } = await supabase.auth.getUser();
        setUser(u);

        // Check if user is in pool
        if (u) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_in_pool")
            .eq("id", u.id)
            .single();

          if (!profile?.is_in_pool) {
            router.push("/pool/join");
            return;
          }
        }
      } catch (e) {
        console.error("Auth error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const fetchRecommendations = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError("");

    try {
      const res = await fetch("/api/pool/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error || "Daily limit reached. Upgrade for more!");
        } else {
          setError(data.error || "Failed to load recommendations");
        }
        return;
      }

      setCandidates(data.candidates || []);
    } catch {
      setError("Failed to load recommendations");
    } finally {
      setFetching(false);
    }
  }, [user, filters]);

  useEffect(() => {
    if (user && !loading) {
      fetchRecommendations();
    }
  }, [user, loading, fetchRecommendations]);

  const handleLike = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/pool/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLikedIds((prev) => new Set([...prev, targetUserId]));

      if (data.matched) {
        setMatchedIds((prev) => new Set([...prev, targetUserId]));
      }
    } catch (err) {
      console.error("Like error:", err);
    }
  };

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
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-surface-lighter bg-surface/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text">Discover</h1>
            <p className="text-xs text-text-muted">Your soulmate recommendations</p>
          </div>
          <button
            onClick={() => router.push("/chat")}
            className="rounded-lg bg-surface-light px-3 py-1.5 text-sm text-text-muted hover:text-text"
          >
            Back to Chat
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap gap-3">
          <select
            value={filters.age_bucket || ""}
            onChange={(e) => setFilters({ ...filters, age_bucket: e.target.value || undefined })}
            className="rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
          >
            <option value="">Any Age</option>
            <option value="18-24">18-24</option>
            <option value="25-30">25-30</option>
            <option value="31-35">31-35</option>
            <option value="36+">36+</option>
          </select>

          <select
            value={filters.zodiac || ""}
            onChange={(e) => setFilters({ ...filters, zodiac: e.target.value || undefined })}
            className="rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
          >
            <option value="">Any Zodiac</option>
            {ZODIAC_SIGNS.map((sign) => (
              <option key={sign} value={sign}>{sign}</option>
            ))}
          </select>

          <select
            value={filters.gender_pref || ""}
            onChange={(e) => setFilters({ ...filters, gender_pref: e.target.value || undefined })}
            className="rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
          >
            <option value="">Any Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <input
            placeholder="City"
            value={filters.city || ""}
            onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
            className="rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none"
          />

          <button
            onClick={fetchRecommendations}
            disabled={fetching}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {fetching ? "Loading..." : "Search"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-accent/30 bg-accent/10 p-4 text-center">
            <p className="text-sm text-accent">{error}</p>
            {error.includes("limit") && (
              <button
                onClick={() => router.push("/payment/upgrade")}
                className="mt-2 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white"
              >
                Upgrade to Plus
              </button>
            )}
          </div>
        )}

        {/* Candidate grid */}
        {candidates.length === 0 && !fetching && !error && (
          <div className="py-20 text-center">
            <div className="mb-4 text-5xl">&#128302;</div>
            <p className="text-lg text-text-muted">No matches found yet</p>
            <p className="mt-1 text-sm text-text-muted/70">Try adjusting your filters or check back later</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((candidate) => {
            const isLiked = likedIds.has(candidate.user_id);
            const isMatched = matchedIds.has(candidate.user_id);

            return (
              <div
                key={candidate.user_id}
                className="overflow-hidden rounded-2xl border border-surface-lighter bg-surface-light"
              >
                {/* Photo placeholder / blurred */}
                <div className="relative aspect-square bg-surface-lighter">
                  {candidate.photo_url ? (
                    <div
                      className="h-full w-full bg-cover bg-center blur-lg"
                      style={{ backgroundImage: `url(${candidate.photo_url})` }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-6xl text-text-muted/30">
                      &#128100;
                    </div>
                  )}
                  {/* Similarity badge */}
                  <div className="absolute right-3 top-3 rounded-full bg-primary/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                    {Math.round(candidate.similarity * 100)}% match
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-text">
                    {candidate.display_name || "Anonymous"}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {candidate.zodiac && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary-light">
                        {candidate.zodiac}
                      </span>
                    )}
                    {candidate.age_bucket && (
                      <span className="rounded-full bg-surface-lighter px-2 py-0.5 text-xs text-text-muted">
                        {candidate.age_bucket}
                      </span>
                    )}
                    {candidate.city && (
                      <span className="rounded-full bg-surface-lighter px-2 py-0.5 text-xs text-text-muted">
                        {candidate.city}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    {isMatched ? (
                      <div className="rounded-xl bg-green-500/20 px-4 py-2 text-center text-sm font-semibold text-green-400">
                        It&apos;s a match! &#128154;
                      </div>
                    ) : isLiked ? (
                      <div className="rounded-xl bg-accent/20 px-4 py-2 text-center text-sm text-accent">
                        Liked &#10084;&#65039;
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLike(candidate.user_id)}
                        className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/80"
                      >
                        Like &#10084;&#65039;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
