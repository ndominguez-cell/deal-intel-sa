// Server-only Supabase client.
//
// Uses the SERVICE ROLE key, which bypasses Row Level Security. This client
// must NEVER be imported into client components or any code shipped to the
// browser. It is intended for use inside API routes / server actions only.
//
// The client is created lazily (on first use) rather than at module import
// time, so a build without env vars present (e.g. CI type-checking, or a
// Vercel build step) does not crash while collecting page data. Env is
// validated at request time instead.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton across hot-reloads / lambda invocations.
declare global {
  // eslint-disable-next-line no-var
  var __sa_auto_match_supabase__: SupabaseClient | undefined;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (globalThis.__sa_auto_match_supabase__) {
    return globalThis.__sa_auto_match_supabase__;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    throw new Error("Missing required env var: SUPABASE_URL");
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { "x-application-name": "sa-auto-match" },
    },
  });

  globalThis.__sa_auto_match_supabase__ = client;
  return client;
}
