import type { APIRoute } from "astro";
import needsData from "../../../../../__mocks__/data/needs.json";

export const prerender = false;

/**
 * MOCK ENDPOINT: GET /api/__mocks__/needs
 * Returns static data without database connection
 * Use this endpoint for frontend testing
 */
export const GET: APIRoute = async ({ url }) => {
  // Simulate network delay (optional)
  await new Promise((resolve) => setTimeout(resolve, 300));

  const shelter_id = url.searchParams.get("shelter_id");
  const category = url.searchParams.get("category");
  const urgency = url.searchParams.get("urgency");
  const fulfilled = url.searchParams.get("fulfilled");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let data = [...needsData.needs];

  // Filter by shelter_id
  if (shelter_id) {
    data = data.filter((need) => need.shelter.id === shelter_id);
  }

  // Filter by category
  if (category) {
    data = data.filter((need) => need.category === category);
  }

  // Filter by urgency
  if (urgency) {
    data = data.filter((need) => need.urgency === urgency);
  }

  // Filter by fulfilled status
  if (fulfilled !== null) {
    const isFulfilled = fulfilled === "true";
    data = data.filter((need) => need.is_fulfilled === isFulfilled);
  }

  // Pagination
  const total = data.length;
  const paginatedData = data.slice(offset, offset + limit);

  return new Response(
    JSON.stringify({
      data: paginatedData,
      pagination: {
        total,
        limit,
        offset,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
