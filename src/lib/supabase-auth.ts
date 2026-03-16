import type { User } from "@supabase/supabase-js";

import type { SupabaseClient } from "@/db/supabase.client";

interface OptionalUserResult {
  user: User | null;
  error: unknown | null;
}

/**
 * Supabase returns AuthSessionMissingError when no auth cookies are present.
 * On public SSR routes this is expected and should be treated as "anonymous".
 */
export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { name?: string; message?: string };
  return (
    maybeError.name === "AuthSessionMissingError" ||
    maybeError.message === "Auth session missing!" ||
    maybeError.message?.includes("Auth session missing") === true
  );
}

export async function getOptionalUser(supabase: SupabaseClient): Promise<OptionalUserResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && isAuthSessionMissingError(error)) {
    return { user: null, error: null };
  }

  return {
    user: user ?? null,
    error: error ?? null,
  };
}
