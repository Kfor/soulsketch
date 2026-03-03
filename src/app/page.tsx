"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PoolStats } from "@/types";

// Example cards data — pre-made for social proof on homepage
const EXAMPLE_CARDS = [
  { id: 1, title: "Dreamy Artist", zodiac: "Pisces", vibe: "Creative Soul", gradient: "from-indigo-500 to-purple-600" },
  { id: 2, title: "Adventurous Spirit", zodiac: "Sagittarius", vibe: "Free Explorer", gradient: "from-orange-400 to-pink-500" },
  { id: 3, title: "Gentle Protector", zodiac: "Cancer", vibe: "Warm Heart", gradient: "from-emerald-400 to-teal-500" },
  { id: 4, title: "Charismatic Leader", zodiac: "Leo", vibe: "Bold & Bright", gradient: "from-yellow-400 to-orange-500" },
  { id: 5, title: "Mysterious Thinker", zodiac: "Scorpio", vibe: "Deep Mind", gradient: "from-violet-600 to-indigo-700" },
  { id: 6, title: "Playful Charmer", zodiac: "Gemini", vibe: "Quick Wit", gradient: "from-cyan-400 to-blue-500" },
  { id: 7, title: "Steady Rock", zodiac: "Taurus", vibe: "Reliable Soul", gradient: "from-green-500 to-emerald-600" },
  { id: 8, title: "Elegant Grace", zodiac: "Libra", vibe: "Harmony Seeker", gradient: "from-pink-400 to-rose-500" },
  { id: 9, title: "Fierce Warrior", zodiac: "Aries", vibe: "Brave Heart", gradient: "from-red-500 to-orange-500" },
  { id: 10, title: "Wise Mentor", zodiac: "Capricorn", vibe: "Old Soul", gradient: "from-slate-500 to-gray-600" },
  { id: 11, title: "Cosmic Dreamer", zodiac: "Aquarius", vibe: "Visionary", gradient: "from-blue-400 to-purple-500" },
  { id: 12, title: "Nurturing Light", zodiac: "Virgo", vibe: "Detail Lover", gradient: "from-lime-400 to-green-500" },
];

export default function Home() {
  const router = useRouter();
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);

  useEffect(() => {
    // Check if returning user
    const ageVerified = localStorage.getItem("soulsketch_age_verified");
    const hasVisited = localStorage.getItem("soulsketch_visited");

    if (ageVerified === "true" && hasVisited === "true") {
      // Return users go straight to chat
      router.replace("/chat");
      return;
    }

    // Fetch pool stats
    fetch("/api/pool/count")
      .then((r) => r.json())
      .then((data) => setPoolStats(data))
      .catch(() => {});
  }, [router]);

  const handleStart = () => {
    localStorage.setItem("soulsketch_visited", "true");
    const ageVerified = localStorage.getItem("soulsketch_age_verified");
    if (ageVerified === "true") {
      router.push("/chat");
    } else {
      router.push("/age-gate");
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      {/* Hero */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-20 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10">
          <p className="mb-3 text-sm font-medium tracking-[4px] text-primary-light uppercase">
            SoulSketch
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight text-text sm:text-5xl">
            Let AI Draw Your
            <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
              {" "}Soulmate
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-text-muted">
            Chat with our AI matchmaker, reveal your ideal partner portrait, and find real matches in our pool.
          </p>

          <button
            onClick={handleStart}
            className="mt-8 rounded-2xl bg-gradient-to-r from-primary to-accent px-8 py-4 text-lg font-bold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105"
          >
            Draw Your Soulmate →
          </button>

          <p className="mt-3 text-xs text-text-muted">Free • No sign-up required</p>

          {/* Pool count */}
          {poolStats && (poolStats.pool_members > 0 || poolStats.sketches_created > 0) && (
            <div className="mt-8 flex justify-center gap-6">
              <div>
                <div className="text-2xl font-bold text-primary-light">
                  {poolStats.sketches_created.toLocaleString()}
                </div>
                <div className="text-xs text-text-muted">Sketches Created</div>
              </div>
              <div className="h-10 w-px bg-surface-lighter" />
              <div>
                <div className="text-2xl font-bold text-accent">
                  {poolStats.pool_members.toLocaleString()}
                </div>
                <div className="text-xs text-text-muted">In the Pool</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Example Wall */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-xl font-bold text-text">
            What others have drawn
          </h2>
          <p className="mb-8 text-center text-sm text-text-muted">
            Real soulmate personas created by our community
          </p>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {EXAMPLE_CARDS.map((card) => (
              <div
                key={card.id}
                className="group overflow-hidden rounded-xl border border-surface-lighter bg-surface-light transition-transform hover:scale-[1.02]"
              >
                <div
                  className={`aspect-square bg-gradient-to-br ${card.gradient} p-4 flex flex-col justify-end`}
                >
                  <div className="rounded-lg bg-black/30 p-2 backdrop-blur-sm">
                    <p className="text-xs font-bold text-white">{card.title}</p>
                    <p className="text-[10px] text-white/70">{card.vibe}</p>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-primary-light">
                    {card.zodiac}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pool Teaser CTA */}
      <section className="border-t border-surface-lighter px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-xl font-bold text-text">
            Find your match in the pool
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            After drawing your soulmate, join the pool to find real people who match your ideal type
          </p>
          <Link
            href="/pool/join"
            className="mt-6 inline-block rounded-xl border border-primary bg-primary/10 px-6 py-3 font-semibold text-primary-light transition-colors hover:bg-primary/20"
          >
            Learn More About the Pool
          </Link>
        </div>
      </section>
    </div>
  );
}
