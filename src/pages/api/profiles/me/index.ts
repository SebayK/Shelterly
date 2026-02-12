import type { APIRoute } from "astro";
import { ProfileService } from "../../../../lib/services/profile.service";
import { UpdateProfileCommandSchema } from "../../../../lib/validation/profile.schemas";
import type { ErrorResponse } from "../../../../types";
import { NotFoundError } from "../../../../lib/errors";

export const prerender = false;

/**
 * GET /api/profiles/me
 * Returns authenticated user's full profile
 * Requires authentication
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Get Supabase client from locals
    const supabase = locals.supabase;
    if (!supabase) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Database connection not available",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Execute business logic
    const profileService = new ProfileService(supabase);
    const profile = await profileService.getAuthenticatedProfile(user.id);

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Handle specific error types
    if (error instanceof NotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // eslint-disable-next-line no-console
    console.error("Unexpected error in GET /api/profiles/me:", error);

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while fetching profile",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * PATCH /api/profiles/me
 * Updates authenticated user's profile
 * Requires authentication
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    // Get Supabase client from locals
    const supabase = locals.supabase;
    if (!supabase) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Database connection not available",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      const errorResponse: ErrorResponse = {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid JSON in request body",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate request body
    const validationResult = UpdateProfileCommandSchema.safeParse(body);

    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check for forbidden fields
    const forbiddenFields = ["status", "role", "nip", "location", "verification_doc_path", "ai_usage_count"];
    const attemptedForbiddenFields = forbiddenFields.filter((field) => field in body);

    if (attemptedForbiddenFields.length > 0) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "FORBIDDEN",
          message: `Cannot modify protected fields: ${attemptedForbiddenFields.join(", ")}`,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updates = validationResult.data;

    // Execute business logic
    const profileService = new ProfileService(supabase);
    const updatedProfile = await profileService.updateProfile(user.id, updates);

    return new Response(JSON.stringify(updatedProfile), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Handle specific error types
    if (error instanceof NotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // eslint-disable-next-line no-console
    console.error("Unexpected error in PATCH /api/profiles/me:", error);

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while updating profile",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
