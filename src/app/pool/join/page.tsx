"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonymousAuth } from "@/lib/auth";

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const AGE_BUCKETS = ["18-24", "25-30", "31-35", "36+"];

export default function PoolJoinPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    display_name: "",
    zodiac: "",
    age_bucket: "",
    city: "",
    gender_pref: "",
    photo: null as File | null,
    optIn: false,
    ageConfirmed: false,
  });

  useEffect(() => {
    async function init() {
      try {
        await ensureAnonymousAuth();
        const supabase = createClient();
        const { data: { user: u } } = await supabase.auth.getUser();
        setUser(u);
      } catch (e) {
        console.error("Auth error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.optIn || !form.ageConfirmed) return;
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("zodiac", form.zodiac);
      formData.set("age_bucket", form.age_bucket);
      formData.set("city", form.city);
      formData.set("gender_pref", form.gender_pref);
      if (form.display_name) formData.set("display_name", form.display_name);
      if (form.photo) formData.set("photo", form.photo);

      const res = await fetch("/api/pool/join", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join pool");
      }

      setSuccess(true);
      setTimeout(() => router.push("/discover"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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

  if (success) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface p-8">
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
          <div className="mb-4 text-5xl">&#10024;</div>
          <h1 className="text-2xl font-bold text-green-400">You&apos;re in the pool!</h1>
          <p className="mt-2 text-green-300/70">Redirecting to your matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text">Join the Soulmate Pool</h1>
          <p className="mt-2 text-sm text-text-muted">
            Find your real-life match based on your AI-drawn soulmate preferences
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Display Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="How others will see you"
              className="w-full rounded-xl border border-surface-lighter bg-surface-light px-4 py-3 text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Photo (optional)
            </label>
            <div className="rounded-xl border-2 border-dashed border-surface-lighter p-6 text-center">
              {form.photo ? (
                <div>
                  <p className="text-sm text-primary-light">{form.photo.name}</p>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, photo: null })}
                    className="mt-2 text-xs text-accent hover:text-accent-light"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="mb-2 text-3xl text-text-muted">&#128247;</div>
                  <p className="text-sm text-text-muted">Click to upload a photo</p>
                  <p className="mt-1 text-xs text-text-muted/50">JPEG or PNG, max 5MB</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size <= 5 * 1024 * 1024) {
                        setForm({ ...form, photo: file });
                      }
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Zodiac */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Zodiac Sign *
            </label>
            <select
              required
              value={form.zodiac}
              onChange={(e) => setForm({ ...form, zodiac: e.target.value })}
              className="w-full rounded-xl border border-surface-lighter bg-surface-light px-4 py-3 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select your sign</option>
              {ZODIAC_SIGNS.map((sign) => (
                <option key={sign} value={sign}>{sign}</option>
              ))}
            </select>
          </div>

          {/* Age Bucket */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Age Range *
            </label>
            <select
              required
              value={form.age_bucket}
              onChange={(e) => setForm({ ...form, age_bucket: e.target.value })}
              className="w-full rounded-xl border border-surface-lighter bg-surface-light px-4 py-3 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select age range</option>
              {AGE_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>{bucket}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              City *
            </label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Your city"
              className="w-full rounded-xl border border-surface-lighter bg-surface-light px-4 py-3 text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Gender Preference */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-muted">
              Looking for *
            </label>
            <select
              required
              value={form.gender_pref}
              onChange={(e) => setForm({ ...form, gender_pref: e.target.value })}
              className="w-full rounded-xl border border-surface-lighter bg-surface-light px-4 py-3 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select preference</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="any">Any</option>
            </select>
          </div>

          {/* 18+ Confirmation */}
          <label className="flex items-start gap-3 rounded-xl border border-surface-lighter bg-surface-light p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ageConfirmed}
              onChange={(e) => setForm({ ...form, ageConfirmed: e.target.checked })}
              className="mt-0.5 h-5 w-5 rounded border-surface-lighter accent-primary"
            />
            <span className="text-sm text-text-muted">
              I confirm I am 18 years of age or older
            </span>
          </label>

          {/* Opt-in Consent */}
          <label className="flex items-start gap-3 rounded-xl border border-surface-lighter bg-surface-light p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.optIn}
              onChange={(e) => setForm({ ...form, optIn: e.target.checked })}
              className="mt-0.5 h-5 w-5 rounded border-surface-lighter accent-primary"
            />
            <div>
              <span className="text-sm text-text">
                I want to join the matching pool
              </span>
              <p className="mt-1 text-xs text-text-muted">
                Your profile will be visible to other pool members. You can leave anytime.
              </p>
            </div>
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !form.optIn || !form.ageConfirmed || !form.zodiac || !form.age_bucket || !form.city || !form.gender_pref}
            className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white transition-all hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Joining..." : "Join the Pool"}
          </button>
        </form>
      </div>
    </div>
  );
}
