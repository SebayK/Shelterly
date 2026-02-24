import type { APIRoute } from "astro";
import { NeedsService } from "@/lib/services/needs.service";
import { NeedIdParamsSchema } from "@/lib/validation/needs.schemas";
import {
  NotFoundError,
  ForbiddenError,
  InternalError,
  createErrorHttpResponse,
  createValidationErrorResponse,
  logError,
  logSuccess,
} from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/needs/:id/fulfill
 * Marks a need as fulfilled. Only the shelter that owns the need may call this endpoint.
 *
 * Responses:
 *   200 – NeedFulfillResponseDTO  { id, is_fulfilled: true, updated_at }
 *   400 – VALIDATION_ERROR  (id is not a valid UUID)
 *   401 – UNAUTHORIZED       (missing or invalid Bearer token)
 *   403 – FORBIDDEN          (authenticated user is not the owner of the need)
 *   404 – NOT_FOUND          (need missing, soft-deleted, or already fulfilled)
 *   500 – INTERNAL_ERROR
 */
export const POST: APIRoute = async ({ params, locals }) => {
  // 1. Validate path parameter
  const validationResult = NeedIdParamsSchema.safeParse({ id: params.id });

  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors);
  }

  const { id } = validationResult.data;

  // 2. Ensure DB client is available (injected by middleware)
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  // 3. Authenticate request
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  // 4. Delegate to service layer
  try {
    const needsService = new NeedsService(supabase);
    const result = await needsService.fulfillNeed(id, user.id);

    logSuccess("POST /api/needs/:id/fulfill", { need_id: id, user_id: user.id });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map known domain errors to appropriate HTTP responses
    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }

    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }

    if (error instanceof InternalError) {
      logError("[POST /api/needs/:id/fulfill]", error);
      return createErrorHttpResponse("INTERNAL_ERROR", error.message, 500);
    }

    // Catch-all for unexpected errors
    logError("[POST /api/needs/:id/fulfill]", error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred while fulfilling the need", 500);
  }
};
