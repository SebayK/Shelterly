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

  // Znajdź profil w profilesWithNeeds
  const basicProfile = profilesData.profilesWithNeeds.find((p) => p.id === id);

  if (!basicProfile) {
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

  // Zwróć dane w formacie ProfileDetailDTO z mockowymi danymi dla brakujących pól
  const response = {
    id: basicProfile.id,
    name: basicProfile.name,
    city: basicProfile.city,
    address: `ul. Testowa ${Math.floor(Math.random() * 100)}, ${basicProfile.city}`,
    location: basicProfile.location,
    phone_number: "+48 123 456 789",
    website_url: `https://www.${basicProfile.name.toLowerCase().replace(/\s+/g, '')}.pl`,
    created_at: new Date().toISOString(),
    needs_summary: {
      total: basicProfile.needs_count,
      urgent: basicProfile.has_urgent_needs ? Math.ceil(basicProfile.needs_count / 3) : 0,
      fulfilled: Math.floor(basicProfile.needs_count / 2),
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
