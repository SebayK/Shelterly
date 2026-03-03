import type { APIRoute } from "astro";
import { createErrorHttpResponse, logErrorWithContext, logSuccess, UnauthorizedError } from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/refresh
 *
 * With @supabase/ssr, token refresh is handled automatically by the client.
 * This endpoint is maintained for backwards compatibility but typically not needed.
 * The SSR adapter automatically refreshes tokens when they're close to expiring.
 *
 * If explicitly called, attempts to refresh the session using cookies.
 * Response: { expires_at: number } (200 OK)
 */
export const POST: APIRoute = async ({ locals }) => {
  // 1. Verify Supabase client is available (injected by middleware)
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  try {
    // 2. Refresh session - Supabase SSR reads refresh token from cookies automatically
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data.session) {
      return createErrorHttpResponse("UNAUTHORIZED", "Unable to refresh session", 401);
    }

    // 3. Log successful token refresh for monitoring
    logSuccess("POST /api/auth/refresh");

    // 4. Cookies are automatically updated by Supabase SSR adapter
    // Return only expires_at
    return new Response(JSON.stringify({ expires_at: data.session.expires_at }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map domain errors to appropriate HTTP responses
    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    // Unexpected errors — log with context
    logErrorWithContext({ endpoint: "POST /api/auth/refresh" }, error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An internal error occurred", 500);
  }
};
