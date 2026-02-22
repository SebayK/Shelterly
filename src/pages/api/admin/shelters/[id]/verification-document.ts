import type { APIRoute } from "astro";
import { AdminService } from "@/lib/services/admin.service";
import { ShelterIdParamSchema } from "@/lib/validation/admin.schemas";
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
 * GET /api/admin/shelters/:id/verification-document
 * Downloads the verification document submitted by a shelter.
 * Returns raw binary data with appropriate Content-Type and Content-Disposition headers.
 * Requires authentication and super_admin role.
 * The response is never cached — document data is sensitive.
 */
export const GET: APIRoute = async ({ params, locals }) => {
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

    // 3. Authenticate the requesting user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // 4. Verify the user has super_admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logErrorWithContext(
        { endpoint: "GET /api/admin/shelters/:id/verification-document", user_id: user.id },
        profileError
      );
      return createErrorHttpResponse("INTERNAL_ERROR", "Unable to retrieve user profile", 500);
    }

    if (!profile || profile.role !== "super_admin") {
      return createErrorHttpResponse("FORBIDDEN", "Access restricted to super administrators", 403);
    }

    // 5. Delegate to service layer — fetches shelter record and downloads file from Storage
    const adminService = new AdminService(supabase);
    const result = await adminService.getVerificationDocument(id);

    logSuccess("GET /api/admin/shelters/:id/verification-document", { shelter_id: id, file: result.fileName });

    // 6. Return binary response with security headers
    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
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
      logError("GET /api/admin/shelters/:id/verification-document", error);
      return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred. Please try again later.", 500);
    }

    logError("GET /api/admin/shelters/:id/verification-document", error);
    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred. Please try again later.", 500);
  }
};
