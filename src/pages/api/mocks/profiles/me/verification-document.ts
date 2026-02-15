import type { APIRoute } from "astro";

export const prerender = false;

/**
 * MOCK ENDPOINT: POST /api/mocks/profiles/me/verification-document
 * Simulates verification document upload
 */
export const POST: APIRoute = async ({ request }) => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  // Simulate upload delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid form data",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "File is required",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Walidacja typu pliku
  const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  if (!allowedTypes.includes(file.type)) {
    return new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid file",
          details: [
            {
              field: "type",
              message: "File must be PDF, JPEG, or PNG",
            },
          ],
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Walidacja rozmiaru
  if (file.size > 5 * 1024 * 1024) {
    return new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid file",
          details: [
            {
              field: "size",
              message: "File size must not exceed 5MB",
            },
          ],
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Mockowana odpowiedź sukcesu
  const timestamp = Date.now();
  const response = {
    verification_doc_path: `verification-docs/550e8400-e29b-41d4-a716-446655440000/${timestamp}-${file.name}`,
    uploaded_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
