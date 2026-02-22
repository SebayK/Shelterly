import type { APIRoute } from "astro";
import { AdminService } from "@/lib/services/admin.service";
import { PendingSheltersQueryParamsSchema } from "@/lib/validation/admin.schemas";
import {
  createValidationErrorResponse,
  createErrorHttpResponse,
  logError,
  logErrorWithContext,
  ForbiddenError,
} from "@/lib/errors";

export const prerender = false;

/**
 * GET /api/admin/shelters/pending
 * Returns a paginated list of shelters pending verification.
 * Requires authentication and super_admin role.
 * Response is never cached — data is sensitive and highly dynamic.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // 1. Verify Supabase client is available (injected by middleware)
    const supabase = locals.supabase;
    if (!supabase) {
      return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
    }

    // 2. Authenticate the requesting user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // 3. Verify the user has super_admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logErrorWithContext({ endpoint: "GET /api/admin/shelters/pending", user_id: user.id }, profileError);
      return createErrorHttpResponse("INTERNAL_ERROR", "Unable to retrieve user profile", 500);
    }

    if (!profile || profile.role !== "super_admin") {
      return createErrorHttpResponse("FORBIDDEN", "Access restricted to super administrators", 403);
    }

    // 4. Parse and validate query parameters
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    const validationResult = PendingSheltersQueryParamsSchema.safeParse({ limit, offset });
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error.errors);
    }

    const params = validationResult.data;

    // 5. Delegate to service layer
    const adminService = new AdminService(supabase);
    const result = await adminService.getPendingShelters(params);

    // 6. Return response — no caching as data is sensitive and highly dynamic
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }

    logError("[GET /api/admin/shelters/pending]", error);
    return createErrorHttpResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred while fetching pending shelters",
      500
    );
  }
};
