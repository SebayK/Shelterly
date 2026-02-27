/**
 * Zod validation schemas for needs-related API endpoints
 */

import { z } from "zod";
import type { Enums } from "@/db/database.types";

/**
 * Validation schema for GET /api/needs query parameters
 * Validates filtering, pagination, and sorting options for needs list
 */
export const NeedsQueryParamsSchema = z.object({
  // Filtering
  shelter_id: z
    .union([z.string().uuid("Invalid UUID format for shelter_id"), z.null(), z.undefined()])
    .transform((val) => val ?? undefined),
  category: z
    .union([
      z.enum([
        "food",
        "textiles",
        "cleaning",
        "medical",
        "toys",
        "other",
      ] as const satisfies readonly Enums<"need_category">[]),
      z.null(),
      z.undefined(),
    ])
    .transform((val) => val ?? undefined),
  urgency: z
    .union([
      z.enum(["low", "normal", "high", "urgent", "critical"] as const satisfies readonly Enums<"urgency_level">[]),
      z.null(),
      z.undefined(),
    ])
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
export type NeedsQueryParamsInput = z.input<typeof NeedsQueryParamsSchema>;
export type NeedsQueryParamsOutput = z.output<typeof NeedsQueryParamsSchema>;

/**
 * Validation schema for GET /api/needs/:id path parameters
 * Validates that the id is a valid UUID
 */
export const NeedIdParamsSchema = z.object({
  id: z.string().uuid("Invalid need ID format"),
});

export type NeedIdParamsInput = z.input<typeof NeedIdParamsSchema>;
export type NeedIdParamsOutput = z.output<typeof NeedIdParamsSchema>;

/**
 * Validation schema for POST /api/needs request body
 * Validates all fields required and optional for creating a new need
 */
export const CreateNeedSchema = z.object({
  category: z.enum([
    "food",
    "textiles",
    "cleaning",
    "medical",
    "toys",
    "other",
  ] as const satisfies readonly Enums<"need_category">[]),
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title must not exceed 255 characters"),
  description: z
    .string()
    .max(2000, "Description must not exceed 2000 characters")
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  shopping_url: z
    .string()
    .url("Invalid URL format for shopping_url")
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  urgency: z
    .enum(["low", "normal", "high", "urgent", "critical"] as const satisfies readonly Enums<"urgency_level">[])
    .default("normal"),
  target_quantity: z
    .number({ invalid_type_error: "target_quantity must be a number" })
    .positive("target_quantity must be greater than 0")
    .max(99999999.99, "target_quantity is too large")
    .refine((val) => Number(val.toFixed(2)) === val, "target_quantity can have at most 2 decimal places"),
  unit: z.enum(["pcs", "kg", "g", "l", "ml", "pack"] as const satisfies readonly Enums<"need_unit">[]),
});

export type CreateNeedInput = z.input<typeof CreateNeedSchema>;
export type CreateNeedOutput = z.output<typeof CreateNeedSchema>;

/**
 * Validation schema for PATCH /api/needs/:id request body
 * All fields are optional — at least one must be provided (enforced by .refine).
 * Cross-field validation: if both current_quantity and target_quantity are provided,
 * current_quantity must be ≤ target_quantity.
 * When only one is provided, the cross-field check against the DB value is done in the service layer.
 */
export const UpdateNeedSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(255, "Title must not exceed 255 characters")
      .optional(),
    description: z.string().max(2000, "Description must not exceed 2000 characters").nullable().optional(),
    shopping_url: z.string().url("Invalid URL format for shopping_url").nullable().optional(),
    urgency: z
      .enum(["low", "normal", "high", "urgent", "critical"] as const satisfies readonly Enums<"urgency_level">[])
      .optional(),
    current_quantity: z
      .number({ invalid_type_error: "current_quantity must be a number" })
      .min(0, "current_quantity must be at least 0")
      .max(99999999.99, "current_quantity is too large")
      .optional(),
    target_quantity: z
      .number({ invalid_type_error: "target_quantity must be a number" })
      .positive("target_quantity must be greater than 0")
      .max(99999999.99, "target_quantity is too large")
      .optional(),
    category: z
      .enum([
        "food",
        "textiles",
        "cleaning",
        "medical",
        "toys",
        "other",
      ] as const satisfies readonly Enums<"need_category">[])
      .optional(),
    unit: z.enum(["pcs", "kg", "g", "l", "ml", "pack"] as const satisfies readonly Enums<"need_unit">[]).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  })
  .refine(
    (data) => {
      // Cross-field: if both quantities provided, current must not exceed target
      if (data.current_quantity !== undefined && data.target_quantity !== undefined) {
        return data.current_quantity <= data.target_quantity;
      }
      return true;
    },
    {
      message: "current_quantity must be less than or equal to target_quantity",
      path: ["current_quantity"],
    }
  );

export type UpdateNeedInput = z.input<typeof UpdateNeedSchema>;
export type UpdateNeedOutput = z.output<typeof UpdateNeedSchema>;
