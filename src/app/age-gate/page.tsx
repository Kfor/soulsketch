"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AgeGatePage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  function handleConfirm() {
    localStorage.setItem("soulsketch_age_verified", "true");
    router.replace("/chat");
  }

  function handleDeny() {
    setError(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-light p-8 text-center shadow-xl">
        <div className="mb-6 text-5xl">✨</div>
        <h1 className="mb-2 text-2xl font-bold text-text">
          Welcome to SoulSketch
        </h1>
        <p className="mb-6 text-text-muted">
          Before we begin drawing your soulmate, please confirm your age.
        </p>

        <div className="mb-4 rounded-lg bg-surface p-4">
          <p className="text-sm text-text-muted">
            You must be 18 or older to use this service.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">
            Sorry, you must be 18 or older to use SoulSketch.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            className="flex-1 rounded-xl border border-surface-lighter px-4 py-3 text-text-muted transition-colors hover:bg-surface-lighter"
          >
            I&apos;m under 18
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            I&apos;m 18 or older
          </button>
        </div>
      </div>
    </div>
  );
}
