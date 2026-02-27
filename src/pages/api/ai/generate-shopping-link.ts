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
    const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later." } }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
        },
      }
    );
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

    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }

    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }

    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    if (error instanceof InternalError) {
      return createErrorHttpResponse("INTERNAL_ERROR", error.message, 500);
    }

    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
};
