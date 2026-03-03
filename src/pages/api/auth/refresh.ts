import type { APIRoute } from "astro";
import { AuthService } from "@/lib/services/auth.service";
import { createErrorHttpResponse, logErrorWithContext, logSuccess, UnauthorizedError } from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/refresh
 *
 * Refreshes the session using the HttpOnly sb-refresh-token cookie.
 * On success, replaces both auth cookies (access + refresh) and returns
 * { expires_at } so the client can schedule the next refresh without ever
 * reading the raw token from JavaScript.
 *
 * Response: { expires_at: number } (200 OK)
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Verify Supabase client is available (injected by middleware)
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  // 2. Read refresh token from HttpOnly cookie — never from the request body.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)sb-refresh-token=([^;]+)/);
  const refreshToken = match ? match[1] : null;

  if (!refreshToken) {
    return createErrorHttpResponse("UNAUTHORIZED", "No refresh token provided", 401);
  }

  try {
    // 3. Delegate business logic to the service layer
    const authService = new AuthService(supabase);
    const result = await authService.refreshToken({ refresh_token: refreshToken });

    // 4. Log successful token refresh for monitoring
    logSuccess("POST /api/auth/refresh");

    // 5. Rotate cookies — both access and refresh tokens are replaced.
    const isProduction = import.meta.env.PROD;
    const secure = isProduction ? "; Secure" : "";
    const maxAgeAccess = Math.max(0, result.expires_at - Math.floor(Date.now() / 1000));
    const maxAgeRefresh = 60 * 60 * 24 * 30;

    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append(
      "Set-Cookie",
      `sb-access-token=${result.access_token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAgeAccess}`
    );
    headers.append(
      "Set-Cookie",
      `sb-refresh-token=${result.refresh_token}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAgeRefresh}`
    );

    // 6. Return only expires_at — the new token is in the cookie, not the body.
    return new Response(JSON.stringify({ expires_at: result.expires_at }), { status: 200, headers });
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
