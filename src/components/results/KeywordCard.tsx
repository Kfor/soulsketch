"use client";

interface KeywordCardProps {
  keywords: string[];
}

export default function KeywordCard({ keywords }: KeywordCardProps) {
  const colors = [
    "bg-purple-500/20 text-purple-300 border-purple-500/30",
    "bg-pink-500/20 text-pink-300 border-pink-500/30",
    "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "bg-teal-500/20 text-teal-300 border-teal-500/30",
    "bg-amber-500/20 text-amber-300 border-amber-500/30",
    "bg-rose-500/20 text-rose-300 border-rose-500/30",
    "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  ];

  return (
    <div className="rounded-2xl bg-surface-light p-6 shadow-lg">
      <h3 className="mb-4 text-center text-lg font-bold text-text">
        Soulmate Persona
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {keywords.map((keyword, i) => (
          <span
            key={keyword}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${colors[i % colors.length]}`}
          >
            {keyword}
          </span>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-text-muted">
        Key traits of your ideal soulmate
      </p>
    </div>
  );
}
