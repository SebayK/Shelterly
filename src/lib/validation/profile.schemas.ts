import { z } from "zod";

/**
 * Validation schemas for Profile API endpoints
 */

/**
 * Schema for GET /api/profiles query parameters
 * Validates location coordinates, filtering, and pagination options
 */
export const ProfilesQueryParamsSchema = z
  .object({
    lat: z.coerce
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional(),
    lon: z.coerce
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional(),
    urgent_only: z.coerce.boolean().optional().default(false),
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
  })
  .refine(
    (data) => {
      // If one coordinate is provided, both must be provided
      const hasLat = data.lat !== undefined;
      const hasLon = data.lon !== undefined;
      return hasLat === hasLon;
    },
    {
      message: "Both latitude and longitude must be provided together",
      path: ["lat", "lon"],
    }
  );

/**
 * Schema for validating profile ID in URL parameters
 */
export const ProfileIdParamsSchema = z.object({
  id: z.string().uuid("Invalid profile ID format"),
});

/**
 * Schema for PATCH /api/profiles/me request body
 * Only editable fields are included
 */
export const UpdateProfileCommandSchema = z
  .object({
    name: z.string().min(1, "Name must not be empty").max(255, "Name must not exceed 255 characters").optional(),
    city: z.string().min(1, "City must not be empty").max(100, "City must not exceed 100 characters").optional(),
    address: z
      .string()
      .min(1, "Address must not be empty")
      .max(255, "Address must not exceed 255 characters")
      .optional(),
    phone_number: z
      .string()
      .regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number format")
      .max(20, "Phone number must not exceed 20 characters")
      .nullable()
      .optional(),
    website_url: z
      .string()
      .url("Invalid URL format")
      .max(255, "URL must not exceed 255 characters")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

/**
 * Schema for POST /api/profiles/me/geocode request body
 */
export const GeocodeCommandSchema = z.object({
  address: z.string().min(1, "Address must not be empty").max(500, "Address must not exceed 500 characters"),
});

/**
 * Schema for validating uploaded file
 * Used for verification document uploads
 */
export const FileUploadSchema = z.object({
  type: z.enum(["application/pdf", "image/jpeg", "image/jpg", "image/png"], {
    errorMap: () => ({ message: "File must be PDF, JPEG, or PNG" }),
  }),
  size: z.number().max(5 * 1024 * 1024, "File size must not exceed 5MB"),
});
