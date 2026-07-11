"use client";

import { ReactNode } from "react";

interface StepCardProps {
  title: string;
  subtitle?: string;
  helper?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * The "window sticker" appraisal card. Off-white paper surface on the near-black
 * background with a torn-perforation top edge feel via the amber header rule.
 */
export default function StepCard({
  title,
  subtitle,
  helper,
  children,
  footer,
}: StepCardProps) {
  return (
    <div className="animate-fade-slide overflow-hidden rounded-2xl bg-surface text-ink shadow-card">
      {/* Sticker header band */}
      <div className="border-b-4 border-dashed border-amber bg-ink px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber">
          Vehicle Match Worksheet
        </p>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <h1 className="text-xl font-extrabold leading-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-ink-700/80">{subtitle}</p>
        ) : null}

        <div className="mt-5">{children}</div>

        {helper ? (
          <p className="mt-4 text-center text-xs text-ink-600/70">{helper}</p>
        ) : null}
      </div>

      {footer ? (
        <div className="border-t border-surface-line bg-surface-muted px-5 py-4 sm:px-7">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
