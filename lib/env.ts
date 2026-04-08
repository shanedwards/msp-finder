const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function requireSupabaseAnonKey(): string {
  const key = getSupabaseAnonKey();
  if (!key) {
    throw new Error(
      "Missing Supabase public key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for backward compatibility).",
    );
  }
  return key;
}

export function isMockModeEnabled(): boolean {
  const raw = process.env.ENABLE_MOCK_MODE?.toLowerCase().trim() ?? "";
  return TRUE_VALUES.has(raw);
}

export function requireOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }
  return apiKey;
}

export function requireSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }
  return key;
}
