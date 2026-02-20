import type { APIRoute } from "astro";
import { NeedsService } from "@/lib/services/needs.service";
import { NeedsQueryParamsSchema, CreateNeedSchema } from "@/lib/validation/needs.schemas";
import { createValidationErrorResponse, createErrorHttpResponse, logError, logErrorWithContext, logSuccess, ForbiddenError } from "@/lib/errors";
import { RateLimiter } from "@/lib/rate-limiter";
import { APP_CONFIG } from "@/lib/config";

export const prerender = false;

/**
 * Module-level singleton — shared across all requests on this server instance.
 * Keyed by shelter ID (user UUID) so limits are per-shelter, not per-IP.
 */
const createNeedLimiter = new RateLimiter(APP_CONFIG.RATE_LIMITING.CREATE_NEED);

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

/**
 * POST /api/needs
 * Creates a new need for the authenticated, verified shelter.
 * Requires authentication. Only accounts with `status === 'verified'` may create needs.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // Hoisted so they are available in the catch block for structured error logging
  let userId: string | undefined;
  let shelterId: string | undefined;

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

    userId = user.id;

    // 3. Load the shelter profile and verify its status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logErrorWithContext(
        { endpoint: "POST /api/needs", user_id: userId },
        profileError
      );
      return createErrorHttpResponse("INTERNAL_ERROR", "Unable to retrieve shelter profile", 500);
    }

    if (!profile) {
      return createErrorHttpResponse("NOT_FOUND", "Shelter profile not found", 404);
    }

    shelterId = profile.id;

    if (profile.status === "pending") {
      return createErrorHttpResponse("ACCOUNT_PENDING", "Your account is awaiting verification", 403);
    }

    if (profile.status !== "verified") {
      return createErrorHttpResponse("FORBIDDEN", "Only verified shelters can create needs", 403);
    }

    // 4. Check rate limit — keyed by shelter ID
    const rateLimit = createNeedLimiter.check(shelterId);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return new Response(
        JSON.stringify({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(APP_CONFIG.RATE_LIMITING.CREATE_NEED.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    // 5. Parse and validate the request body with Zod
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return createErrorHttpResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
    }

    const validationResult = CreateNeedSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error.errors);
    }

    const command = validationResult.data;

    // 6. Delegate creation to service layer
    const needsService = new NeedsService(supabase);
    const created = await needsService.createNeed(profile.id, command);

    // 7. Log successful creation for metrics tracking
    logSuccess("POST /api/needs", { shelter_id: shelterId, need_id: created.id, category: created.category });

    // 8. Return 201 Created with the new resource
    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }

    // user_id and shelter_id are available here if resolved before the exception
    logErrorWithContext({ endpoint: "POST /api/needs", user_id: userId, shelter_id: shelterId }, error);
    return createErrorHttpResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred while creating the need",
      500
    );
  }
};
