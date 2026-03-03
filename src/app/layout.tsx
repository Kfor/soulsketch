import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulSketch — Draw Your Soulmate",
  description:
    "Let AI draw your ideal soulmate through a fun chat experience. Share your results and find your match!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
