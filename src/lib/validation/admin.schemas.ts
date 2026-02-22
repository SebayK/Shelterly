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

/**
 * Validation schema for the :id path parameter used in shelter admin routes.
 * Ensures the provided ID is a valid UUID v4.
 */
export const ShelterIdParamSchema = z.object({
  id: z.string().uuid("Invalid shelter ID format"),
});

export type ShelterIdParamOutput = z.output<typeof ShelterIdParamSchema>;

/**
 * Validation schema for PATCH /api/admin/shelters/:id/status request body.
 * - `status` must be one of: verified, rejected, suspended (pending is not allowed).
 * - `rejection_reason` is required when status is "rejected" (3–500 chars).
 * - `rejection_reason` must be absent or null for other statuses.
 */
export const UpdateShelterStatusSchema = z
  .object({
    status: z.enum(["verified", "rejected", "suspended"], {
      errorMap: () => ({ message: "Status must be one of: verified, rejected, suspended" }),
    }),
    rejection_reason: z
      .string()
      .min(3, "Rejection reason must be at least 3 characters")
      .max(500, "Rejection reason must not exceed 500 characters")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "rejected" && !data.rejection_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejection_reason"],
        message: "Rejection reason is required when status is rejected",
      });
    }
    if (data.status !== "rejected" && data.rejection_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejection_reason"],
        message: "Rejection reason must be null or absent for non-rejected statuses",
      });
    }
  });

export type UpdateShelterStatusOutput = z.output<typeof UpdateShelterStatusSchema>;
