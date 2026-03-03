"use client";

export default function TypingIndicator() {
  return (
    <div className="mb-4 flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-surface-light px-4 py-3">
        <div className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
        <div className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
        <div className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
      </div>
    </div>
  );
}
