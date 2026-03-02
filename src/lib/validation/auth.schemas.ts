import { z } from "zod";

/**
 * Zod validation schema for POST /api/auth/login request body.
 * Validates email format and enforces password length constraints.
 */
export const LoginCommandSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .max(255, "Email must not exceed 255 characters"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password must not be empty")
    .max(128, "Password must not exceed 128 characters"),
});

/**
 * Zod validation schema for POST /api/auth/signup request body.
 * Validates email format, enforces strong password requirements,
 * and validates all shelter profile fields including optional ones.
 */
export const SignupCommandSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .max(255, "Email must not exceed 255 characters"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
  profile: z.object({
    name: z
      .string({ required_error: "Shelter name is required" })
      .min(2, "Shelter name must be at least 2 characters")
      .max(255, "Shelter name must not exceed 255 characters"),
    nip: z.string({ required_error: "NIP is required" }).regex(/^\d{10}$/, "NIP must be exactly 10 digits"),
    city: z
      .string({ required_error: "City is required" })
      .min(2, "City must be at least 2 characters")
      .max(100, "City must not exceed 100 characters"),
    address: z
      .string({ required_error: "Address is required" })
      .min(5, "Address must be at least 5 characters")
      .max(255, "Address must not exceed 255 characters"),
    phone_number: z
      .string()
      .regex(/^\+?[0-9\s-]{7,20}$/, "Invalid phone number format")
      .optional(),
    website_url: z.string().url("Invalid website URL format").optional(),
  }),
});

/**
 * Zod validation schema for POST /api/auth/refresh request body.
 * Validates that refresh_token is a non-empty string.
 */
export const RefreshTokenCommandSchema = z.object({
  refresh_token: z.string({ required_error: "Refresh token is required" }).min(1, "Refresh token must not be empty"),
});
