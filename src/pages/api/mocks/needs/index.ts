import type { APIRoute } from "astro";
import needsData from "../../../../../__mocks__/data/needs.json";
import { NeedsQueryParamsSchema } from "@/lib/validation/needs.schemas";
import { createValidationErrorResponse } from "@/lib/errors";

export const prerender = false;

/**
 * MOCK ENDPOINT: GET /api/mocks/needs
 * Returns static data without database connection
 * Use this endpoint for frontend testing
 */
export const GET: APIRoute = async ({ url }) => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }
  // Simulate network delay (optional)
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Extract query parameters
  const shelter_id = url.searchParams.get("shelter_id");
  const category = url.searchParams.get("category");
  const urgency = url.searchParams.get("urgency");
  const fulfilled = url.searchParams.get("fulfilled");
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  // Validate using the same schema as real API
  const validationResult = NeedsQueryParamsSchema.safeParse({
    shelter_id,
    category,
    urgency,
    fulfilled,
    limit,
    offset,
  });

  if (!validationResult.success) {
    return createValidationErrorResponse(validationResult.error.errors, "Invalid query parameters");
  }

  const params = validationResult.data;

  let data = [...needsData.needs];

  // Filter by shelter_id
  if (params.shelter_id) {
    data = data.filter((need) => need.shelter.id === params.shelter_id);
  }

  // Filter by category
  if (params.category) {
    data = data.filter((need) => need.category === params.category);
  }

  // Filter by urgency
  if (params.urgency) {
    data = data.filter((need) => need.urgency === params.urgency);
  }

  // Filter by fulfilled status
  if (params.fulfilled !== undefined) {
    data = data.filter((need) => need.is_fulfilled === params.fulfilled);
  }

  // Pagination
  const total = data.length;
  const paginatedData = data.slice(params.offset, params.offset + params.limit);

  return new Response(
    JSON.stringify({
      data: paginatedData,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
