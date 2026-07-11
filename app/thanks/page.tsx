"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import FunnelShell from "@/components/FunnelShell";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Ensure the Meta Pixel base code is present, then init. Returns false if we
 * have no pixel id configured (nothing to fire). The standard fbq bootstrap
 * is injected once; guarded so repeated calls are harmless.
 */
function ensurePixel(): boolean {
  if (!PIXEL_ID) return false;
  if (typeof window === "undefined") return false;

  /* eslint-disable */
  const w = window as any;
  if (!w.fbq) {
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

    w.fbq("init", PIXEL_ID);
    w.fbq("track", "PageView");
  }
  /* eslint-enable */

  return true;
}

export default function ThanksPage() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const ready = ensurePixel();
    if (ready) {
      (window as any).fbq("track", "Lead", {
        content_name: "SA Auto Match Lead",
        source: "sa-auto-match",
      });
    }
  }, []);

  return (
    <FunnelShell>
      <div className="animate-fade-slide overflow-hidden rounded-2xl bg-surface text-ink shadow-card">
        <div className="border-b-4 border-dashed border-amber bg-ink px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber">
            Request Received
          </p>
        </div>

        <div className="px-6 py-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-9 w-9 text-amber-700"
            >
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-extrabold text-ink">You&apos;re all set!</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-700/80">
            A vehicle specialist is reviewing your info right now. Keep an eye on
            your phone — we&apos;ll reach out shortly with real matches and payment
            options.
          </p>

          <div className="mt-6 rounded-xl border border-surface-line bg-white p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-700/70">
              What happens next
            </p>
            <ul className="mt-2 space-y-2 text-sm text-ink-700/80">
              <li className="flex items-start gap-2">
                <span className="text-amber-700">1.</span> We review your trade
                and preferences.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-700">2.</span> A specialist texts or
                calls you.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-700">3.</span> You pick the match
                that fits your budget.
              </li>
            </ul>
          </div>

          <Link
            href="/"
            className="mt-6 inline-block text-sm font-semibold text-ink-600/70 underline underline-offset-2 hover:text-ink"
          >
            Start over
          </Link>
        </div>
      </div>
    </FunnelShell>
  );
}
