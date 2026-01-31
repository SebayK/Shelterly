import type { APIRoute } from "astro";
import { ProfileService } from "../../../lib/services/profile.service";
import { ProfilesQueryParamsSchema } from "../../../lib/validation/profile.schemas";
import type { ErrorResponse } from "../../../types";

export const prerender = false;

/**
 * GET /api/profiles
 * Returns list of verified shelters with optional geolocation filtering
 * Public endpoint - no authentication required
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Extract query parameters
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    const urgent_only = url.searchParams.get("urgent_only");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    // Validate query parameters
    const validationResult = ProfilesQueryParamsSchema.safeParse({
      lat,
      lon,
      urgent_only,
      limit,
      offset,
    });

    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
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

    const params = validationResult.data;

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
    const result = await profileService.getVerifiedProfiles(params);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while fetching profiles",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
