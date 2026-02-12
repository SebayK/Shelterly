import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { NeedsService } from "@/lib/services/needs.service";
import { needsQueryParamsSchema } from "@/lib/validation/needs.schemas";
import type { ErrorResponse } from "@/types";

export const prerender = false;

/**
 * GET /api/needs
 * Returns list of needs from verified shelters with filtering and pagination
 * Public endpoint - no authentication required
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Extract query parameters from URL
    const shelter_id = url.searchParams.get("shelter_id");
    const category = url.searchParams.get("category");
    const urgency = url.searchParams.get("urgency");
    const fulfilled = url.searchParams.get("fulfilled");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    // Validate query parameters using Zod schema
    const validationResult = needsQueryParamsSchema.safeParse({
      shelter_id,
      category,
      urgency,
      fulfilled,
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

    // Get Supabase client from locals (middleware injects it)
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

    // Execute business logic via service layer
    const needsService = new NeedsService(supabase);
    const result = await needsService.getNeeds(params);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Distinguish between validation errors and other errors
    if (error instanceof ZodError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.errors.map((err) => ({
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

    // Generic error response for unexpected errors
    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while fetching needs",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
