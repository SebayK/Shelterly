import type { APIRoute } from "astro";
import { AuthService } from "@/lib/services/auth.service";
import { SignupCommandSchema } from "@/lib/validation/auth.schemas";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  logErrorWithContext,
  logSuccess,
  ConflictError,
} from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/signup
 *
 * Registers a new shelter account in the system.
 * Creates a Supabase Auth user and inserts a linked profile with `pending` status.
 * The account requires admin verification before full access is granted.
 *
 * Request body: SignupCommand { email, password, profile: { name, nip, city, address, phone_number?, website_url? } }
 * Response: SignupResponseDTO (201 Created)
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
  const validationResult = SignupCommandSchema.safeParse(rawBody);
  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors);
  }

  const command = validationResult.data;

  try {
    // 4. Delegate business logic to the service layer
    const authService = new AuthService(supabase);
    const result = await authService.signup(command);

    // 5. Log successful registration for monitoring
    logSuccess("POST /api/auth/signup", { user_id: result.user.id });

    // 6. Return 201 Created with the SignupResponseDTO
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map domain errors to appropriate HTTP responses
    if (error instanceof ConflictError) {
      return createErrorHttpResponse("CONFLICT", error.message, 409);
    }

    // Unexpected errors — log with context (email/nip are redacted automatically by logErrorWithContext)
    logErrorWithContext(
      {
        endpoint: "POST /api/auth/signup",
        request_body: { email: command.email, profile: { name: command.profile.name } },
      },
      error
    );

    return createErrorHttpResponse("INTERNAL_ERROR", "An internal error occurred", 500);
  }
};
