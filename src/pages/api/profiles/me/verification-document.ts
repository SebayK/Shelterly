import type { APIRoute } from "astro";
import { ProfileService } from "../../../../lib/services/profile.service";
import { FileUploadSchema } from "../../../../lib/validation/profile.schemas";
import type { ErrorResponse } from "../../../../types";

export const prerender = false;

/**
 * POST /api/profiles/me/verification-document
 * Uploads verification document for authenticated shelter
 * Requires authentication
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get Supabase client from locals
    const supabase = locals.supabase;
    if (!supabase) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Database connection not available",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      const errorResponse: ErrorResponse = {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid form data",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get file from form data
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "File is required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate file type and size
    const validationResult = FileUploadSchema.safeParse({
      type: file.type,
      size: file.size,
    });

    if (!validationResult.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid file",
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Execute business logic
    const profileService = new ProfileService(supabase);
    const result = await profileService.uploadVerificationDocument(user.id, file);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred while uploading document",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
