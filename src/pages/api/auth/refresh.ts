import type { APIRoute } from "astro";
import { AuthService } from "@/lib/services/auth.service";
import { RefreshTokenCommandSchema } from "@/lib/validation/auth.schemas";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  logErrorWithContext,
  logSuccess,
  UnauthorizedError,
} from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/refresh
 *
 * Refreshes the access token using a valid refresh token.
 * Returns a new access_token and its expires_at timestamp.
 * The refresh token itself is managed internally by Supabase (rotated automatically).
 *
 * Request body: { refresh_token: string }
 * Response: RefreshTokenResponseDTO (200 OK)
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Verify Supabase client is available (injected by middleware)
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  // 2. Parse JSON body — catch malformed payloads early
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorHttpResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  // 3. Validate request body with Zod schema
  const validationResult = RefreshTokenCommandSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors);
  }

  const command = validationResult.data;

  try {
    // 4. Delegate business logic to the service layer
    const authService = new AuthService(supabase);
    const result = await authService.refreshToken(command);

    // 5. Log successful token refresh for monitoring
    logSuccess("POST /api/auth/refresh");

    // 6. Return 200 OK with the RefreshTokenResponseDTO
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map domain errors to appropriate HTTP responses
    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    // Unexpected errors — log with context (refresh_token is redacted automatically)
    logErrorWithContext(
      {
        endpoint: "POST /api/auth/refresh",
      },
      error
    );

    return createErrorHttpResponse("INTERNAL_ERROR", "An internal error occurred", 500);
  }
};
