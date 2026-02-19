import type { APIRoute } from "astro";
import needsData from "../../../../../__mocks__/data/needs.json";
import { NeedIdParamsSchema } from "@/lib/validation/needs.schemas";
import { createValidationErrorResponse } from "@/lib/errors";
import type { NeedDetailDTO } from "@/types";

export const prerender = false;

/**
 * MOCK ENDPOINT: GET /api/mocks/needs/:id
 * Returns static need detail data without database connection.
 * Use this endpoint for frontend development and testing.
 */
export const GET: APIRoute = async ({ params }) => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Validate path parameter
  const validationResult = NeedIdParamsSchema.safeParse({ id: params.id });

  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors);
  }

  const { id } = validationResult.data;

  // Find need in static data
  const need = needsData.needs.find((n) => n.id === id);

  if (!need) {
    return new Response(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "Need not found or deleted",
        },
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Map to NeedDetailDTO (enriched with detail-only fields absent from mock list data)
  const response: NeedDetailDTO = {
    id: need.id,
    shelter: {
      id: need.shelter.id,
      name: need.shelter.name,
      city: need.shelter.city,
      phone_number: null,
    },
    category: need.category,
    title: need.title,
    description: need.description ?? null,
    shopping_url: null,
    urgency: need.urgency,
    target_quantity: need.target_quantity,
    current_quantity: need.current_quantity,
    unit: need.unit,
    progress_percentage: need.progress_percentage,
    is_fulfilled: need.is_fulfilled,
    created_at: need.created_at,
    updated_at: null,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
