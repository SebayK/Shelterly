/**
 * Zod validation schemas for needs-related API endpoints
 */

import { z } from "zod";
import type { Enums } from "@/db/database.types";

/**
 * Validation schema for GET /api/needs query parameters
 * Validates filtering, pagination, and sorting options for needs list
 */
export const needsQueryParamsSchema = z.object({
  // Filtering
  shelter_id: z
    .union([z.string().uuid("Invalid UUID format for shelter_id"), z.null(), z.undefined()])
    .transform((val) => val ?? undefined),
  category: z
    .union([z.enum(["food", "textiles", "cleaning", "medical", "toys", "other"] as const), z.null(), z.undefined()])
    .transform((val) => val ?? undefined),
  urgency: z
    .union([z.enum(["low", "normal", "high", "urgent", "critical"] as const), z.null(), z.undefined()])
    .transform((val) => val ?? undefined),
  fulfilled: z
    .union([z.enum(["true", "false"] as const), z.null(), z.undefined()])
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),

  // Pagination
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

/**
 * TypeScript type inferred from the schema
 */
export type NeedsQueryParamsInput = z.input<typeof needsQueryParamsSchema>;
export type NeedsQueryParamsOutput = z.output<typeof needsQueryParamsSchema>;
