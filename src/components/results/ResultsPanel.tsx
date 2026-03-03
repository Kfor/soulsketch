"use client";

import type { ZodiacMatch } from "@/types";
import PortraitCard from "./PortraitCard";
import KeywordCard from "./KeywordCard";
import ZodiacCard from "./ZodiacCard";

interface ResultsPanelProps {
  portraitUrl: string;
  keywords: string[];
  zodiacMatches: ZodiacMatch[];
  userSign: string;
  isFreeTier?: boolean;
}

export default function ResultsPanel({
  portraitUrl,
  keywords,
  zodiacMatches,
  userSign,
  isFreeTier = true,
}: ResultsPanelProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text">Your Results</h2>
        <p className="text-sm text-text-muted">
          Three cards revealing your soulmate connection
        </p>
      </div>

      <PortraitCard imageUrl={portraitUrl} isFreeTier={isFreeTier} />
      <KeywordCard keywords={keywords} />
      <ZodiacCard userSign={userSign} matches={zodiacMatches} />

      {isFreeTier && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-center">
          <p className="text-sm font-medium text-accent">
            Want HD, watermark-free cards?
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Unlock with a one-time purchase or invite 2 friends
          </p>
          <button className="mt-3 rounded-xl bg-accent px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/80">
            Unlock HD Export
          </button>
        </div>
      )}
    </div>
  );
}
