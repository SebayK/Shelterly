import type { APIRoute } from "astro";
import { ProfileService } from "../../../../lib/services/profile.service";
import { GeocodeCommandSchema } from "../../../../lib/validation/profile.schemas";
import type { ErrorResponse } from "../../../../types";
import { AddressNotFoundError } from "../../../../lib/errors";
import { logError } from "../../../../lib/errors";

export const prerender = false;

/**
 * POST /api/profiles/me/geocode
 * Geocodes an address to geographic coordinates
 * Requires authentication
 */
export const POST: APIRoute = async ({ request, locals }) => {
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
    const validationResult = GeocodeCommandSchema.safeParse(body);

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

    const { address, city } = validationResult.data;
    const geocodeQuery = [address.trim(), city?.trim()].filter(Boolean).join(", ");

    // Execute business logic
    const profileService = new ProfileService(supabase);
    const result = await profileService.geocodeAddress(geocodeQuery);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Handle specific error types
    if (error instanceof AddressNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logError("[POST /api/profiles/me/geocode]", error);

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during geocoding",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
