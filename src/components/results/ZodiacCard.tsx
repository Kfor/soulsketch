"use client";

import type { ZodiacMatch } from "@/types";

interface ZodiacCardProps {
  userSign: string;
  matches: ZodiacMatch[];
}

export default function ZodiacCard({ userSign, matches }: ZodiacCardProps) {
  // Sort by score descending, take top 6
  const topMatches = [...matches]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return (
    <div className="rounded-2xl bg-surface-light p-6 shadow-lg">
      <h3 className="mb-1 text-center text-lg font-bold text-text">
        Cosmic Compatibility
      </h3>
      <p className="mb-4 text-center text-sm text-text-muted">
        {userSign} &mdash; Your top soulmate signs
      </p>

      <div className="space-y-3">
        {topMatches.map((match) => (
          <div key={match.sign}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-text">{match.sign}</span>
              <span className="text-text-muted">{match.score}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${match.score}%`,
                  background: `linear-gradient(90deg, var(--color-primary) 0%, var(--color-accent) 100%)`,
                }}
              />
            </div>
            <p className="mt-0.5 text-xs text-text-muted">{match.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
