/**
 * Zod validation schemas for AI-related API endpoints
 */

import { z } from "zod";
import type { Enums } from "@/db/database.types";

/**
 * Need category enum for AI command validation
 */
export const NeedCategoryEnum = z.enum([
  "food",
  "textiles",
  "cleaning",
  "medical",
  "toys",
  "other",
] as const satisfies readonly Enums<"need_category">[]);

/**
 * Need unit enum for AI command validation
 */
export const NeedUnitEnum = z.enum(["pcs", "kg", "g", "l", "ml", "pack"] as const satisfies readonly Enums<"need_unit">[]);

/**
 * Validation schema for POST /api/ai/generate-description request body
 */
export const GenerateDescriptionCommandSchema = z.object({
  need_id: z.string().uuid({ message: "need_id must be a valid UUID" }),
  category: NeedCategoryEnum,
  title: z.string().trim().min(1, { message: "title is required" }).max(200, { message: "title is too long" }),
  target_quantity: z
    .number({ invalid_type_error: "target_quantity must be a number" })
    .positive({ message: "target_quantity must be greater than 0" }),
  unit: NeedUnitEnum,
});

export type GenerateDescriptionCommandInput = z.input<typeof GenerateDescriptionCommandSchema>;
export type GenerateDescriptionCommandOutput = z.output<typeof GenerateDescriptionCommandSchema>;

/**
 * Validation schema for POST /api/ai/generate-shopping-link request body
 */
export const GenerateShoppingLinkCommandSchema = z.object({
  need_id: z.string().uuid({ message: "need_id must be a valid UUID" }),
  title: z.string().trim().min(1, { message: "title is required" }).max(200, { message: "title is too long" }),
  category: NeedCategoryEnum,
});

export type GenerateShoppingLinkCommandInput = z.input<typeof GenerateShoppingLinkCommandSchema>;
export type GenerateShoppingLinkCommandOutput = z.output<typeof GenerateShoppingLinkCommandSchema>;
