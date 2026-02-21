import type { APIRoute } from "astro";
import type { AIGenerateShoppingLinkResponseDTO } from "@/types";
import { APP_CONFIG } from "@/lib/config";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  logErrorWithContext,
  logSuccess,
} from "@/lib/errors";
import { RateLimiter } from "@/lib/rate-limiter";
import { AIService } from "@/lib/services/ai.service";
import { GenerateShoppingLinkCommandSchema } from "@/lib/validation/ai.schemas";

export const prerender = false;

const generateShoppingLinkLimiter = new RateLimiter(APP_CONFIG.AI.RATE_LIMITING.GENERATE_SHOPPING_LINK);

export const POST: APIRoute = async ({ request, locals }) => {
  // 1. Verify DB connection
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  // 2. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  // 3. Check rate limit
  const rateLimit = generateShoppingLinkLimiter.check(user.id);
  if (!rateLimit.allowed) {
    return createErrorHttpResponse("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.", 429);
  }

  // 4. Parse request body
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return createErrorHttpResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  // 5. Validate with Zod schema
  const parsed = GenerateShoppingLinkCommandSchema.safeParse(rawBody);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error.errors);
  }

  // 6. Execute business logic via AIService
  try {
    const aiService = new AIService(supabase);
    const result: AIGenerateShoppingLinkResponseDTO = await aiService.generateShoppingLink(parsed.data, user.id);

    logSuccess("POST /api/ai/generate-shopping-link", {
      user_id: user.id,
      need_id: parsed.data.need_id,
      ai_usage_incremented: result.ai_usage_incremented,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logErrorWithContext(
      {
        endpoint: "POST /api/ai/generate-shopping-link",
        user_id: user.id,
        request_body: {
          need_id: parsed.data.need_id,
          title: parsed.data.title,
          category: parsed.data.category,
        },
      },
      error
    );

    const errorName = error instanceof Error ? error.name : undefined;
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

    if (error instanceof NotFoundError || errorName === "NotFoundError") {
      return createErrorHttpResponse("NOT_FOUND", errorMessage, 404);
    }

    if (error instanceof ForbiddenError || errorName === "ForbiddenError") {
      return createErrorHttpResponse("FORBIDDEN", errorMessage, 403);
    }

    if (error instanceof UnauthorizedError || errorName === "UnauthorizedError") {
      return createErrorHttpResponse("UNAUTHORIZED", errorMessage, 401);
    }

    if (error instanceof InternalError || errorName === "InternalError") {
      return createErrorHttpResponse("INTERNAL_ERROR", errorMessage, 500);
    }

    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
};
