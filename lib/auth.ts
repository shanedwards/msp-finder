import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

const VALID_EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email",
  "email_change",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && VALID_EMAIL_OTP_TYPES.includes(value as EmailOtpType);
}

/**
 * Server-side function to verify an email OTP (e.g. from sign-up or magic link).
 * Accepts raw query params; validates token_hash and type.
 * Returns { error: null } on success, or { error: message } on failure.
 */
export async function verifyEmailOtp(
  token_hash: string | null,
  type: string | null
): Promise<{ error: string | null }> {
  if (!token_hash || !isEmailOtpType(type)) {
    return { error: "No token hash or type" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  return { error: error?.message ?? null };
}

/**
 * Server-side function to get the currently authenticated user.
 * Returns null when no user is authenticated.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}
