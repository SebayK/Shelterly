import type { APIRoute } from "astro";
import profilesData from "../../../../../__mocks__/data/profiles.json";

export const prerender = false;

/**
 * MOCK ENDPOINT: GET /api/mocks/profiles/:id
 * Returns static shelter details data
 */
export const GET: APIRoute = async ({ params }) => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const { id } = params;

  // Znajdź profil
  const profile = profilesData.profiles.find((p) => p.id === id && p.status === "verified");

  if (!profile) {
    return new Response(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "Shelter not found or not verified",
        },
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Zwróć dane w formacie ProfileDetailDTO
  const response = {
    id: profile.id,
    name: profile.name,
    city: profile.city,
    address: profile.address,
    location: profile.location,
    phone_number: profile.phone_number,
    website_url: profile.website_url,
    created_at: profile.created_at,
    needs_summary: {
      total: 12,
      urgent: 3,
      fulfilled: 5,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
