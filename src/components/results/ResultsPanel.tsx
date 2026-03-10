"use client";

import { useState } from "react";
import type { ZodiacMatch } from "@/types";
import { isAnonymousUser } from "@/lib/auth";
import PortraitCard from "./PortraitCard";
import KeywordCard from "./KeywordCard";
import ZodiacCard from "./ZodiacCard";

interface ResultsPanelProps {
  portraitUrl: string;
  keywords: string[];
  zodiacMatches: ZodiacMatch[];
  userSign: string;
  isFreeTier?: boolean;
  sessionId?: string;
  onRequireEmail?: () => void;
}

export default function ResultsPanel({
  portraitUrl,
  keywords,
  zodiacMatches,
  userSign,
  isFreeTier = true,
  sessionId,
  onRequireEmail,
}: ResultsPanelProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const requireEmail = async (): Promise<boolean> => {
    const anon = await isAnonymousUser();
    if (anon && onRequireEmail) {
      onRequireEmail();
      return false;
    }
    return true;
  };

  const handleShare = async () => {
    if (!sessionId) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.url) {
        if (navigator.share) {
          await navigator.share({
            title: "I drew my soulmate on SoulSketch!",
            text: "Can you guess which one I like? Take the challenge!",
            url: data.url,
          });
        } else {
          await navigator.clipboard.writeText(data.url);
        }
        setShareUrl(data.url);
      }
    } catch {
      // Sharing cancelled or failed — that's fine
    } finally {
      setSharing(false);
    }
  };

  const handleCheckout = async (priceType: "export" | "plus") => {
    const canProceed = await requireEmail();
    if (!canProceed) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckingOut(false);
    }
  };

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

      {/* Share buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleShare}
          disabled={sharing || !sessionId}
          className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {sharing ? "Creating link..." : shareUrl ? "Link copied!" : "Share Results"}
        </button>
      </div>

      {/* HD unlock / Stripe */}
      {isFreeTier && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-center">
          <p className="text-sm font-medium text-accent">
            Want HD, watermark-free cards?
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Unlock with a one-time purchase ($2.99) or invite 2 friends
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleCheckout("export")}
              disabled={checkingOut}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
            >
              {checkingOut ? "..." : "Unlock HD — $2.99"}
            </button>
            <button
              onClick={() => handleCheckout("plus")}
              disabled={checkingOut}
              className="flex-1 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary-light transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              Plus — $7.99/mo
            </button>
          </div>
        </div>
      )}

      {/* Pool teaser with blurred candidates */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-center text-sm font-medium text-primary-light">
          See who matches you in real life
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 w-16 rounded-xl bg-surface-lighter"
              style={{
                background: `linear-gradient(135deg, ${
                  i === 1 ? "#7c3aed30" : i === 2 ? "#f472b630" : "#a78bfa30"
                }, transparent)`,
              }}
            >
              <div className="flex h-full w-full items-center justify-center text-2xl opacity-30">
                👤
              </div>
            </div>
          ))}
        </div>
        <a
          href="/pool/join"
          className="mt-3 block w-full rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Join the Soulmate Pool
        </a>
      </div>
    </div>
  );
}
