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
