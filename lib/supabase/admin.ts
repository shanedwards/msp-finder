import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServiceRoleKey } from "@/lib/env";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }

  const serviceRoleKey = requireSupabaseServiceRoleKey();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        // Keep apikey aligned with the server key to avoid mixed-key auth errors.
        apikey: serviceRoleKey,
      },
    },
  });
}
