import type { APIRoute } from "astro";
import type { AIGenerateDescriptionResponseDTO } from "@/types";
import { APP_CONFIG } from "@/lib/config";
import {
  createErrorHttpResponse,
  createValidationErrorResponse,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  logErrorWithContext,
  logSuccess,
} from "@/lib/errors";
import { RateLimiter } from "@/lib/rate-limiter";
import { AIService } from "@/lib/services/ai.service";
import { GenerateDescriptionCommandSchema } from "@/lib/validation/ai.schemas";

export const prerender = false;

const generateDescriptionLimiter = new RateLimiter(APP_CONFIG.AI.RATE_LIMITING.GENERATE_DESCRIPTION);

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const rateLimit = generateDescriptionLimiter.check(user.id);
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

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return createErrorHttpResponse("INVALID_REQUEST", "Request body must be valid JSON", 400);
  }

  const parsed = GenerateDescriptionCommandSchema.safeParse(rawBody);
  if (!parsed.success) {
    return createValidationErrorResponse(parsed.error.errors);
  }

  try {
    const aiService = new AIService(supabase);
    const result: AIGenerateDescriptionResponseDTO = await aiService.generateNeedDescription(parsed.data, user.id);

    logSuccess("POST /api/ai/generate-description", {
      user_id: user.id,
      need_id: parsed.data.need_id,
      ai_usage_incremented: result.ai_usage_incremented,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return createErrorHttpResponse("NOT_FOUND", error.message, 404);
    }

    if (error instanceof ForbiddenError) {
      return createErrorHttpResponse("FORBIDDEN", error.message, 403);
    }

    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    // Unexpected errors only — log with context
    logErrorWithContext(
      {
        endpoint: "POST /api/ai/generate-description",
        user_id: user.id,
        request_body: {
          need_id: parsed.data.need_id,
          category: parsed.data.category,
          title: parsed.data.title,
          target_quantity: parsed.data.target_quantity,
          unit: parsed.data.unit,
        },
      },
      error
    );

    return createErrorHttpResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
};
