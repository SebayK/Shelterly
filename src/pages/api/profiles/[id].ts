import type { APIRoute } from "astro";
import { ProfileService } from "../../../lib/services/profile.service";
import { ProfileIdParamsSchema } from "../../../lib/validation/profile.schemas";
import type { ErrorResponse } from "../../../types";

export const prerender = false;

/**
 * GET /api/profiles/:id
 * Returns detailed information about a specific verified shelter
 * Public endpoint - no authentication required
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Validate profile ID parameter
    const validationResult = ProfileIdParamsSchema.safeParse(params);

    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid profile ID format",
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

    const { id } = validationResult.data;

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

    // Execute business logic
    const profileService = new ProfileService(supabase);
    const profile = await profileService.getProfileById(id);

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Handle NOT_FOUND error
    if (error instanceof Error && error.message === "NOT_FOUND") {
      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND",
          message: "Shelter not found or not verified",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

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
