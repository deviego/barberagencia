"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Supabase client no browser (anon key, sempre sob RLS). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
