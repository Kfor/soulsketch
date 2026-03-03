"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const ageVerified = localStorage.getItem("soulsketch_age_verified");
    if (ageVerified === "true") {
      router.replace("/chat");
    } else {
      router.replace("/age-gate");
    }
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="typing-dot mx-1 h-3 w-3 rounded-full bg-primary" />
      <div className="typing-dot mx-1 h-3 w-3 rounded-full bg-primary" />
      <div className="typing-dot mx-1 h-3 w-3 rounded-full bg-primary" />
    </div>
  );
}
