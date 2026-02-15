import type { APIRoute } from "astro";
import { NeedsService } from "@/lib/services/needs.service";
import { NeedsQueryParamsSchema } from "@/lib/validation/needs.schemas";
import { createValidationErrorResponse, createErrorHttpResponse, logError } from "@/lib/errors";

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
    const validationResult = NeedsQueryParamsSchema.safeParse({
      shelter_id,
      category,
      urgency,
      fulfilled,
      limit,
      offset,
    });

    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error.errors);
    }

    const params = validationResult.data;

    // Get Supabase client from locals (middleware injects it)
    const supabase = locals.supabase;
    if (!supabase) {
      return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
    }

    // Execute business logic via service layer
    const needsService = new NeedsService(supabase);
    const result = await needsService.getNeeds(params);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=120",
      },
    });
  } catch (error) {
    // Log unexpected errors for monitoring
    logError("[GET /api/needs]", error);

    // Generic error response for unexpected errors
    return createErrorHttpResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred while fetching needs",
      500
    );
  }
};
