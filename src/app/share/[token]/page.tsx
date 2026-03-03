import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: "Someone drew their soulmate! | SoulSketch",
    description: "Can you guess which soulmate they chose? Take the challenge and draw yours!",
    openGraph: {
      title: "Someone drew their soulmate!",
      description: "Take the challenge and draw yours!",
      images: [`${appUrl}/api/og/${token}`],
    },
    twitter: {
      card: "summary_large_image",
      title: "Someone drew their soulmate!",
      images: [`${appUrl}/api/og/${token}`],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createServiceSupabase();

  // Look up the share link
  const { data: shareLink } = await supabase
    .from("share_links")
    .select("session_id, expires_at")
    .eq("token", token)
    .single();

  const isExpired = shareLink && new Date(shareLink.expires_at) < new Date();
  const isValid = shareLink && !isExpired;

  // Get portrait from chat messages if valid
  let portraitUrl: string | null = null;
  if (isValid) {
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("content_image_url")
      .eq("session_id", shareLink.session_id)
      .not("content_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    portraitUrl = messages?.[0]?.content_image_url || null;
  }

  return (
    <div className="min-h-dvh bg-surface">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <p className="mb-2 text-sm font-medium tracking-[4px] text-primary-light uppercase">
          SoulSketch
        </p>

        {isValid ? (
          <>
            <h1 className="mb-4 text-center text-3xl font-bold text-text">
              Someone drew their soulmate
            </h1>
            <p className="mb-8 text-center text-text-muted">
              Can you guess which one they like? Take the challenge!
            </p>

            {/* Blurred portrait preview */}
            {portraitUrl && (
              <div className="mb-8 w-64 overflow-hidden rounded-2xl border border-surface-lighter">
                <div
                  className="aspect-square bg-cover bg-center blur-xl brightness-75"
                  style={{ backgroundImage: `url(${portraitUrl})` }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="mb-4 text-center text-3xl font-bold text-text">
              {isExpired ? "This link has expired" : "Draw Your Soulmate"}
            </h1>
            <p className="mb-8 text-center text-text-muted">
              {isExpired
                ? "But you can still create your own soulmate portrait!"
                : "Let AI sketch your ideal soulmate through a fun chat experience"}
            </p>
          </>
        )}

        {/* CTA */}
        <Link
          href="/chat"
          className="rounded-2xl bg-gradient-to-r from-primary to-accent px-8 py-4 text-lg font-bold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105"
        >
          Draw Your Soulmate &rarr;
        </Link>

        <p className="mt-4 text-xs text-text-muted">Free &bull; No sign-up required</p>
      </div>
    </div>
  );
}
