"use client";

interface OptionButtonProps {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onClick: () => void;
}

/**
 * Large tap target for tap-only funnel steps. Selecting typically advances the
 * funnel, so we style clearly and keep the hit area generous for mobile.
 */
export default function OptionButton({
  label,
  sublabel,
  selected = false,
  onClick,
}: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "group flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all active:scale-[0.99]",
        selected
          ? "border-amber bg-amber/15 shadow-amber"
          : "border-surface-line bg-white hover:border-amber-600 hover:bg-amber/5",
      ].join(" ")}
    >
      <span className="flex flex-col">
        <span className="text-base font-bold text-ink">{label}</span>
        {sublabel ? (
          <span className="text-xs text-ink-600/70">{sublabel}</span>
        ) : null}
      </span>
      <span
        className={[
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-amber bg-amber text-ink"
            : "border-surface-line text-transparent group-hover:border-amber-600",
        ].join(" ")}
        aria-hidden="true"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </button>
  );
}
