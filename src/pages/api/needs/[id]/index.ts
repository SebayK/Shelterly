import type { APIRoute } from "astro";
import { NeedsService } from "@/lib/services/needs.service";
import { NeedIdParamsSchema, UpdateNeedSchema } from "@/lib/validation/needs.schemas";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  InternalError,
  createErrorHttpResponse,
  createValidationErrorResponse,
  logError,
  logErrorWithContext,
  logSuccess,
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

/**
 * PATCH /api/needs/:id
 * Partially updates an existing need. Only the verified shelter that owns the need may call this.
 *
 * Responses:
 *   200 – NeedUpdateResponseDTO  { id, title, description, urgency, current_quantity, progress_percentage, updated_at }
 *   400 – VALIDATION_ERROR   (invalid UUID, empty body, bad field values, current_quantity > target_quantity)
 *   400 – INVALID_REQUEST    (body is not valid JSON)
 *   401 – UNAUTHORIZED       (missing or invalid Bearer token)
 *   403 – FORBIDDEN          (not the owner or account not verified / not a shelter role)
 *   403 – ACCOUNT_PENDING    (shelter account is pending verification)
 *   404 – NOT_FOUND          (need missing or soft-deleted)
 *   500 – INTERNAL_ERROR
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  // 1. Validate path parameter
  const idValidation = NeedIdParamsSchema.safeParse({ id: params.id });

  if (!idValidation.success) {
    return createValidationErrorResponse(idValidation.error.errors);
  }

  const { id } = idValidation.data;

  // 2. Ensure DB client is available (injected by middleware)
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  // 3. Authenticate the requesting user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  // 4. Load shelter profile and verify role + status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    logErrorWithContext({ endpoint: "PATCH /api/needs/:id", user_id: user.id }, profileError);
    return createErrorHttpResponse("INTERNAL_ERROR", "Unable to retrieve shelter profile", 500);
  }

  if (!profile) {
    return createErrorHttpResponse("NOT_FOUND", "Shelter profile not found", 404);
  }

  // Only shelters (not super_admin) may update needs
  if (profile.role !== "shelter") {
    return createErrorHttpResponse("FORBIDDEN", "Only shelters can update needs", 403);
  }

  // Shelter must be verified to make changes
  if (profile.status === "pending") {
    return createErrorHttpResponse("ACCOUNT_PENDING", "Your account is pending verification", 403);
  }

  if (profile.status !== "verified") {
    return createErrorHttpResponse("FORBIDDEN", "Your account does not have the required status to update needs", 403);
  }

  // 5. Parse request body as JSON
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorHttpResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  // 6. Validate body with Zod schema
  const bodyValidation = UpdateNeedSchema.safeParse(rawBody);

  if (!bodyValidation.success) {
    return createValidationErrorResponse(bodyValidation.error.errors);
  }

  const command = bodyValidation.data;

  // 7. Delegate to service layer (ownership check + DB update done inside)
  try {
    const needsService = new NeedsService(supabase);
    const result = await needsService.updateNeed(id, user.id, command);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }

    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }

    if (error instanceof ValidationError) {
      return createErrorHttpResponse("VALIDATION_ERROR", error.message, 400);
    }

    if (error instanceof InternalError) {
      logError("[PATCH /api/needs/:id]", error);
      return createErrorHttpResponse("INTERNAL_ERROR", error.message, 500);
    }

    // Catch-all for unexpected errors
    logError("[PATCH /api/needs/:id]", error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred while updating the need", 500);
  }
};

/**
 * DELETE /api/needs/:id
 * Soft-deletes a need (sets `deleted_at`). Only the shelter that owns the need may call this.
 *
 * Responses:
 *   200 – NeedDeleteResponseDTO  { message, deleted_at }
 *   400 – VALIDATION_ERROR  (id is not a valid UUID)
 *   401 – UNAUTHORIZED       (missing or invalid Bearer token)
 *   403 – FORBIDDEN          (authenticated user is not the owner of the need)
 *   404 – NOT_FOUND          (need missing or already soft-deleted)
 *   500 – INTERNAL_ERROR
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
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

  // 3. Authenticate the requesting user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  // 4. Delegate to service layer (ownership check + DB update done inside)
  try {
    const needsService = new NeedsService(supabase);
    const result = await needsService.deleteNeed(id, user.id);

    logSuccess("DELETE /api/needs/:id", { need_id: id, user_id: user.id });

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
      logError("[DELETE /api/needs/:id]", error);
      return createErrorHttpResponse("INTERNAL_ERROR", error.message, 500);
    }

    // Catch-all for unexpected errors
    logError("[DELETE /api/needs/:id]", error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred while deleting the need", 500);
  }
};
