"use client";

import type { OptionItem } from "@/types";

interface OptionCardsProps {
  options: OptionItem[];
  onSelect: (option: OptionItem) => void;
  disabled?: boolean;
}

export default function OptionCards({
  options,
  onSelect,
  disabled = false,
}: OptionCardsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 px-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="rounded-xl border border-primary/30 bg-surface-light px-4 py-2 text-sm text-text transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {option.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={option.image_url}
              alt={option.label}
              className="mb-1 h-16 w-16 rounded-lg object-cover"
            />
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
