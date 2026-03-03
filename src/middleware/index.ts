import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { supabaseClient } from "../db/supabase.client";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

/**
 * Extracts the access token from the sb-access-token HttpOnly cookie.
 * Returns an empty string when the cookie is absent.
 */
function getTokenFromCookie(cookieHeader: string): string {
  const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
  return match ? match[1] : "";
}

export const onRequest = defineMiddleware((context, next) => {
  // Prefer explicit Authorization header (e.g. server-to-server calls), then
  // fall back to the HttpOnly session cookie set by POST /api/auth/login.
  const explicitAuth = context.request.headers.get("authorization") ?? "";
  const cookieToken = getTokenFromCookie(context.request.headers.get("cookie") ?? "");
  const authHeader = explicitAuth || (cookieToken ? `Bearer ${cookieToken}` : "");
  // Generate a correlation id for this request for easier tracing in logs
  const correlationId =
    (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  context.locals.correlation_id = correlationId;

  // Expose correlation id to downstream handlers via response header when possible
  // (Astro handlers can read it from locals; route responses should include it if desired)
  // We'll also set a request-scoped header so frameworks that read request headers can use it.
  context.request.headers.set?.("x-correlation-id", correlationId as string);

  // Create a typed Supabase client for the request so we can set per-request
  // auth headers without breaking the global client type.
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Ensure the Locals type (src/env.d.ts) remains satisfied by matching the
  // exported SupabaseClient shape. The created client is typed as Database.
  context.locals.supabase = supabase as typeof supabaseClient;
  return next();
});
