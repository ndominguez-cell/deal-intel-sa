"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
}

export default function PrimaryButton({
  children,
  loading = false,
  disabled,
  className,
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-extrabold uppercase tracking-wide transition-all active:scale-[0.99]",
        isDisabled
          ? "cursor-not-allowed bg-surface-line text-ink-600/50"
          : "bg-amber text-ink shadow-amber hover:bg-amber-400",
        className ?? "",
      ].join(" ")}
    >
      {loading ? (
        <>
          <svg
            className="h-5 w-5 animate-spin text-ink"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z"
            />
          </svg>
          Sending…
        </>
      ) : (
        children
      )}
    </button>
  );
}
