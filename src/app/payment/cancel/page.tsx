import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8 text-center bg-surface">
      <div className="rounded-2xl border border-surface-lighter bg-surface-light p-8 max-w-md">
        <div className="mb-4 text-5xl">&#128533;</div>
        <h1 className="text-2xl font-bold text-text mb-2">Payment Cancelled</h1>
        <p className="text-text-muted mb-6">
          No worries! You can still enjoy SoulSketch for free, or try again when you&apos;re ready.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/chat"
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Back to SoulSketch
          </Link>
          <Link
            href="/pool/join"
            className="text-sm text-text-muted hover:text-primary-light transition-colors"
          >
            Or invite friends to unlock features for free
          </Link>
        </div>
      </div>
    </main>
  );
}
