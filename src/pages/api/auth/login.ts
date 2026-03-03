import type { APIRoute } from "astro";
import { AuthService } from "@/lib/services/auth.service";
import { LoginCommandSchema } from "@/lib/validation/auth.schemas";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  logErrorWithContext,
  logSuccess,
  UnauthorizedError,
  AccountPendingError,
  AccountSuspendedError,
} from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/login
 *
 * Authenticates an existing shelter user with email and password.
 * On success, Supabase automatically sets HttpOnly session cookies via the SSR adapter.
 * Returns user profile data only - tokens are never exposed in the response body.
 * Accounts in `pending` or `suspended` status are rejected with 403.
 *
 * Request body: { email: string; password: string }
 * Response: { user, profile } (200 OK)
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
  const validationResult = LoginCommandSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors);
  }

  const command = validationResult.data;

  try {
    // 4. Delegate business logic to the service layer
    const authService = new AuthService(supabase);
    const result = await authService.login(command);

    // 5. Log successful login for monitoring
    logSuccess("POST /api/auth/login", { user_id: result.user.id });

    // 6. Return user/profile data only.
    //    Supabase SSR automatically sets HttpOnly session cookies via the
    //    cookie adapter in middleware, so tokens never appear in the response body.
    const { session, ...clientResponse } = result;
    return new Response(JSON.stringify(clientResponse), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    // Map domain errors to appropriate HTTP responses
    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    if (error instanceof AccountPendingError) {
      return createErrorHttpResponse("ACCOUNT_PENDING", error.message, 403);
    }

    if (error instanceof AccountSuspendedError) {
      return createErrorHttpResponse("ACCOUNT_SUSPENDED", error.message, 403);
    }

    // Unexpected errors — log with context (email is redacted automatically by logErrorWithContext)
    logErrorWithContext(
      {
        endpoint: "POST /api/auth/login",
        request_body: { email: command.email },
      },
      error
    );

    return createErrorHttpResponse("INTERNAL_ERROR", "An internal error occurred", 500);
  }
};
