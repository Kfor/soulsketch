import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8 text-center bg-surface">
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 max-w-md">
        <div className="mb-4 text-5xl">&#127881;</div>
        <h1 className="text-2xl font-bold text-green-400 mb-2">Payment Successful!</h1>
        <p className="text-green-300/80 mb-6">
          Your account has been upgraded. Enjoy your premium features!
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/chat"
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Back to SoulSketch
          </Link>
          <Link
            href="/discover"
            className="rounded-xl bg-surface-light px-6 py-3 font-semibold text-text-muted hover:text-text transition-colors"
          >
            Discover Matches
          </Link>
        </div>
      </div>
    </main>
  );
}
