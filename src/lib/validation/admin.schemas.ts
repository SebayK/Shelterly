/**
 * Zod validation schemas for admin-related API endpoints
 */

import { z } from "zod";

/**
 * Validation schema for GET /api/admin/shelters/pending query parameters
 * Validates pagination options for the pending shelters list
 */
export const PendingSheltersQueryParamsSchema = z.object({
  limit: z
    .union([
      z.coerce
        .number()
        .int("Limit must be an integer")
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must not exceed 100"),
      z.null(),
      z.undefined(),
    ])
    .transform((val) => val ?? 20),
  offset: z
    .union([
      z.coerce.number().int("Offset must be an integer").min(0, "Offset must be non-negative"),
      z.null(),
      z.undefined(),
    ])
    .transform((val) => val ?? 0),
});

export type PendingSheltersQueryParamsOutput = z.output<typeof PendingSheltersQueryParamsSchema>;
