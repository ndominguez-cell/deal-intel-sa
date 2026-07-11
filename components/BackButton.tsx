"use client";

interface BackButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function BackButton({ onClick, disabled }: BackButtonProps) {
  if (disabled) return <span />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600/70 transition-colors hover:text-ink"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M12.7 15.3a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 1.4L8.42 10l4.28 4.3a1 1 0 0 1 0 1.4Z"
          clipRule="evenodd"
        />
      </svg>
      Back
    </button>
  );
}
