import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseAnonKey } from "@/lib/env";

export function createClient() {
  const anonKey = requireSupabaseAnonKey();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey,
  );
}
