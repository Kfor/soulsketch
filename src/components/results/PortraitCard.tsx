"use client";

import { WATERMARK_TEXT, WATERMARK_OPACITY } from "@/lib/watermark";

interface PortraitCardProps {
  imageUrl: string;
  isFreeTier?: boolean;
}

export default function PortraitCard({
  imageUrl,
  isFreeTier = true,
}: PortraitCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface-light shadow-lg">
      <div className="relative aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Your soulmate portrait"
          className="h-full w-full object-cover"
        />
        {isFreeTier && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ opacity: WATERMARK_OPACITY }}
          >
            <span
              className="rotate-[-30deg] select-none text-5xl font-bold text-white"
              style={{ textShadow: "2px 2px 12px rgba(0,0,0,0.6)" }}
            >
              {WATERMARK_TEXT}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 text-center">
        <h3 className="text-lg font-bold text-text">Your Soulmate Portrait</h3>
        <p className="mt-1 text-sm text-text-muted">
          AI-generated based on your preferences
        </p>
      </div>
    </div>
  );
}
