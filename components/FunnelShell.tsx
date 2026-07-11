"use client";

import { ReactNode } from "react";
import Link from "next/link";

/**
 * Page chrome: brand lockup + centered, mobile-first content column.
 */
export default function FunnelShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-ink">
      <header className="px-5 pb-2 pt-6">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber text-sm font-black text-ink">
            SA
          </span>
          <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-surface">
            Auto Match
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 pb-10 pt-2">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>

      <footer className="px-5 pb-6">
        <p className="mx-auto max-w-md text-center text-[11px] leading-relaxed text-surface/40">
          SA Auto Match connects shoppers with participating dealers. Not a
          lender or financing company; we do not make credit decisions. Message
          and data rates may apply.{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-surface/70"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
