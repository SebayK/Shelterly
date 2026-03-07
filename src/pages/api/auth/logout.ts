import type { APIRoute } from "astro";
import { AuthService } from "@/lib/services/auth.service";
import { createErrorHttpResponse, logErrorWithContext, logSuccess, UnauthorizedError } from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/logout
 *
 * Ends the current user session by invalidating auth tokens.
 * Supabase SSR automatically clears HttpOnly session cookies via the cookie adapter.
 *
 * Response: { message: "Logout successful" } (200 OK)
 * Errors:
 *   401 UNAUTHORIZED  — missing or invalid token
 *   500 INTERNAL_ERROR — Supabase signOut failure or missing client
 */
export const POST: APIRoute = async ({ locals }) => {
  // 1. Guard: verify Supabase client is available (injected by middleware)
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  try {
    // 2. Delegate to service layer - Supabase automatically clears cookies
    const authService = new AuthService(supabase);
    const result = await authService.logout();

    // 3. Log successful logout
    logSuccess("POST /api/auth/logout");

    // 4. Return success - cookies are automatically cleared by Supabase SSR
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // 401 — unauthenticated request (missing/expired/invalid token)
    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    // 500 — unexpected errors (InternalError from signOut or any other exception)
    logErrorWithContext({ endpoint: "POST /api/auth/logout" }, error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An internal error occurred", 500);
  }
};
