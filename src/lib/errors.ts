/**
 * Custom error classes and helper functions for better error handling
 */

import type { ErrorResponse, ErrorCode, ErrorDetail } from "@/types";

// ============================================================================
// Custom Error Classes
// ============================================================================

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Access forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class InternalError extends Error {
  constructor(message = "An internal error occurred") {
    super(message);
    this.name = "InternalError";
  }
}

export class AddressNotFoundError extends Error {
  constructor(message = "Address not found by geocoding service") {
    super(message);
    this.name = "AddressNotFoundError";
  }
}

// ============================================================================
// Error Response Helper Functions
// ============================================================================

/**
 * Creates a standardized error response object
 * @param code - Error code from the ErrorCode enum
 * @param message - Human-readable error message
 * @param details - Optional array of field-specific error details
 * @returns Formatted ErrorResponse object
 */
export function createErrorResponse(code: ErrorCode, message: string, details?: ErrorDetail[]): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Creates an HTTP Response with error JSON payload
 * @param code - Error code from the ErrorCode enum
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Optional array of field-specific error details
 * @returns Response object with error JSON
 */
export function createErrorHttpResponse(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: ErrorDetail[]
): Response {
  const errorResponse = createErrorResponse(code, message, details);

  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a validation error response from Zod error
 * @param zodErrors - Array of Zod errors
 * @returns Response object with validation error details
 */
export function createValidationErrorResponse(
  zodErrors: Array<{ path: (string | number)[]; message: string }>
): Response {
  const details: ErrorDetail[] = zodErrors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return createErrorHttpResponse("VALIDATION_ERROR", "Invalid query parameters", 400, details);
}

/**
 * Logs an error with context information
 * @param context - Context string (e.g., "[GET /api/needs]")
 * @param error - Error object or message
 */
export function logError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`${context} Error:`, error.message, error.stack);
  } else {
    console.error(`${context} Error:`, error);
  }
}

/**
 * Structured context for enriched error logging.
 * Sensitive fields (tokens, passwords) must never be included.
 */
export interface ErrorLogContext {
  endpoint: string;
  user_id?: string;
  shelter_id?: string;
  need_id?: string;
  /** Partial request body — omit sensitive fields before passing */
  request_body?: Record<string, unknown>;
  constraint?: string;
}

/**
 * Logs an error with structured context for monitoring and debugging.
 * Includes timestamp, endpoint, optional user/shelter IDs and a partial
 * (non-sensitive) request body snapshot.
 *
 * @param context - Structured context metadata
 * @param error - Error object or unknown value
 */
export function logErrorWithContext(context: ErrorLogContext, error: unknown): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    endpoint: context.endpoint,
  };

  if (context.user_id) payload.user_id = context.user_id;
  if (context.shelter_id) payload.shelter_id = context.shelter_id;
  if (context.request_body) payload.request_body = context.request_body;
  if (context.constraint) payload.constraint = context.constraint;

  if (error instanceof Error) {
    payload.error_message = error.message;
    payload.stack_trace = error.stack;
    console.error("[ERROR]", JSON.stringify(payload));
  } else {
    payload.error_message = String(error);
    console.error("[ERROR]", JSON.stringify(payload));
  }
}

/**
 * Logs a successful operation for monitoring / success metrics.
 * Use to track creation counts and other business-significant events.
 *
 * @param endpoint - Endpoint identifier (e.g. "POST /api/needs")
 * @param meta - Additional non-sensitive metadata (e.g. resource id, shelter_id)
 */
export function logSuccess(endpoint: string, meta?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    endpoint,
    ...meta,
  };
  console.info("[SUCCESS]", JSON.stringify(payload));
}
