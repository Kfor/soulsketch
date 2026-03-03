"use client";

import { useState, type FormEvent } from "react";
import { linkEmailOTP, verifyOTP } from "@/lib/auth";

interface EmailLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}

export default function EmailLinkDialog({
  open,
  onClose,
  onLinked,
}: EmailLinkDialogProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSendOTP(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await linkEmailOTP(email);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyOTP(email, code);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-light p-6">
        <h2 className="mb-2 text-lg font-bold text-text">
          {step === "email" ? "Link Your Account" : "Enter Verification Code"}
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          {step === "email"
            ? "Save your results and unlock more features"
            : `We sent a code to ${email}`}
        </p>

        {error && (
          <p className="mb-3 text-sm text-red-400">{error}</p>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOTP}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="mb-3 w-full rounded-xl bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-surface-lighter px-4 py-2 text-sm text-text-muted"
              >
                Later
              </button>
              <button
                type="submit"
                disabled={loading || !email}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              required
              maxLength={6}
              className="mb-3 w-full rounded-xl bg-surface px-4 py-2.5 text-center text-lg tracking-widest text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
