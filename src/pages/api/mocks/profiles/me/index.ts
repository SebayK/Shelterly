import type { APIRoute } from "astro";
import profilesData from "../../../../../../__mocks__/data/profiles.json";

export const prerender = false;

/**
 * MOCK ENDPOINT: GET /api/mocks/profiles/me
 * Returns mocked user profile (always first verified profile)
 */
export const GET: APIRoute = async () => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Check Authorization header (optional)
  // In mock always return first verified shelter data

  const profile = profilesData.profiles.find((p) => p.status === "verified");

  if (!profile) {
    return new Response(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "Profile not found",
        },
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify(profile), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * MOCK ENDPOINT: PATCH /api/mocks/profiles/me
 * Simulates profile update
 */
export const PATCH: APIRoute = async ({ request }) => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid JSON in request body",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Sprawdź chronione pola
  const forbiddenFields = ["status", "role", "nip", "location", "verification_doc_path", "ai_usage_count"];
  const attemptedForbidden = forbiddenFields.filter((field) => field in body);

  if (attemptedForbidden.length > 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: "FORBIDDEN",
          message: `Cannot modify protected fields: ${attemptedForbidden.join(", ")}`,
        },
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Sprawdź czy jest coś do aktualizacji
  if (Object.keys(body).length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: [
            {
              field: "_root",
              message: "At least one field must be provided for update",
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

  // Zwróć mockowaną odpowiedź
  const response = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: body.name || "Schronisko dla Zwierząt w Warszawie",
    city: body.city || "Warszawa",
    updated_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
