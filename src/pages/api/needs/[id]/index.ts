import type { APIRoute } from "astro";
import { NeedsService } from "@/lib/services/needs.service";
import { NeedIdParamsSchema } from "@/lib/validation/needs.schemas";
import {
  NotFoundError,
  InternalError,
  createErrorHttpResponse,
  createValidationErrorResponse,
  logError,
} from "@/lib/errors";

export const prerender = false;

/**
 * GET /api/needs/:id
 * Returns full details of a single need.
 * Public endpoint – no authentication required.
 *
 * Responses:
 *   200 – NeedDetailDTO
 *   400 – VALIDATION_ERROR (id is not a valid UUID)
 *   404 – NOT_FOUND (need missing, soft-deleted, or shelter not verified)
 *   500 – INTERNAL_ERROR
 */
export const GET: APIRoute = async ({ params, locals }) => {
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

  // 3. Delegate to service layer
  try {
    const needsService = new NeedsService(supabase);
    const need = await needsService.getNeedById(id);

    return new Response(JSON.stringify(need), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map known domain errors to appropriate HTTP responses
    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }

    if (error instanceof InternalError) {
      logError("[GET /api/needs/:id]", error);
      return createErrorHttpResponse("INTERNAL_ERROR", error.message, 500);
    }

    // Catch-all for unexpected errors
    logError("[GET /api/needs/:id]", error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred while fetching the need", 500);
  }
};
