"use client";

import type { ChatMessage } from "@/types";
import { WATERMARK_TEXT, WATERMARK_OPACITY } from "@/lib/watermark";

interface MessageBubbleProps {
  message: ChatMessage;
  isFreeTier?: boolean;
}

export default function MessageBubble({
  message,
  isFreeTier = true,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-white"
            : "bg-surface-light text-text"
        }`}
      >
        {/* Text content */}
        {message.content_text && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content_text}
          </p>
        )}

        {/* Image card */}
        {message.content_image_url && (
          <div className="relative mt-3 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.content_image_url}
              alt="Soulmate sketch"
              className="w-full rounded-xl"
            />
            {/* Watermark overlay for free tier */}
            {isFreeTier && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ opacity: WATERMARK_OPACITY }}
              >
                <span
                  className="rotate-[-30deg] select-none text-4xl font-bold text-white"
                  style={{
                    textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {WATERMARK_TEXT}
                </span>
              </div>
            )}
            {/* Sketch level badge */}
            {message.sketch_level && (
              <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
                {message.sketch_level === "outline" && "Rough outline"}
                {message.sketch_level === "simple" && "Taking shape..."}
                {message.sketch_level === "detailed" && "Getting clear!"}
                {message.sketch_level?.startsWith("ai_") && "AI Generated"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
