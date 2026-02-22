import type { APIRoute } from "astro";
import { AdminService } from "@/lib/services/admin.service";
import { ShelterIdParamSchema, UpdateShelterStatusSchema } from "@/lib/validation/admin.schemas";
import {
  createValidationErrorResponse,
  createErrorHttpResponse,
  logError,
  logErrorWithContext,
  logSuccess,
  NotFoundError,
  ForbiddenError,
  InternalError,
} from "@/lib/errors";

export const prerender = false;

/**
 * PATCH /api/admin/shelters/:id/status
 * Updates the verification status of a shelter (verified, rejected, suspended).
 * Requires authentication and super_admin role.
 * Response is never cached — data is sensitive and highly dynamic.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    // 1. Verify Supabase client is available (injected by middleware)
    const supabase = locals.supabase;
    if (!supabase) {
      return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
    }

    // 2. Validate path parameter :id
    const idValidation = ShelterIdParamSchema.safeParse({ id: params.id });
    if (!idValidation.success) {
      return createValidationErrorResponse(idValidation.error.errors);
    }
    const { id } = idValidation.data;

    // 3. Parse request body — guard against malformed JSON
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return createErrorHttpResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
    }

    // 4. Validate request body
    const bodyValidation = UpdateShelterStatusSchema.safeParse(rawBody);
    if (!bodyValidation.success) {
      return createValidationErrorResponse(bodyValidation.error.errors);
    }
    const command = bodyValidation.data;

    // 5. Authenticate the requesting user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // 6. Verify the user has super_admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logErrorWithContext({ endpoint: "PATCH /api/admin/shelters/:id/status", user_id: user.id }, profileError);
      return createErrorHttpResponse("INTERNAL_ERROR", "Unable to retrieve user profile", 500);
    }

    if (!profile || profile.role !== "super_admin") {
      return createErrorHttpResponse("FORBIDDEN", "Access restricted to super administrators", 403);
    }

    // 7. Delegate to service layer
    const adminService = new AdminService(supabase);
    const result = await adminService.updateShelterStatus(id, command);

    logSuccess("PATCH /api/admin/shelters/:id/status", { shelter_id: id, new_status: command.status });

    // 8. Return response — no caching as data is sensitive
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }
    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }
    if (error instanceof InternalError) {
      logError("PATCH /api/admin/shelters/:id/status", error);
      return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred. Please try again later.", 500);
    }

    logError("PATCH /api/admin/shelters/:id/status", error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred. Please try again later.", 500);
  }
};
