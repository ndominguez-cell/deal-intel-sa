"use client";

import OptionButton from "./OptionButton";

export interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface OptionGridProps {
  options: Option[];
  value: string;
  onSelect: (value: string) => void;
  columns?: 1 | 2;
}

export default function OptionGrid({
  options,
  value,
  onSelect,
  columns = 1,
}: OptionGridProps) {
  return (
    <div
      className={[
        "grid gap-3",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
      ].join(" ")}
    >
      {options.map((opt) => (
        <OptionButton
          key={opt.value}
          label={opt.label}
          sublabel={opt.sublabel}
          selected={value === opt.value}
          onClick={() => onSelect(opt.value)}
        />
      ))}
    </div>
  );
}
