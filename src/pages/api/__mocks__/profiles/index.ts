import type { APIRoute } from "astro";
import profilesData from "../../../../../__mocks__/data/profiles.json";

export const prerender = false;

/**
 * MOCK ENDPOINT: GET /api/__mocks__/profiles
 * Zwraca statyczne dane bez połączenia z bazą
 * Użyj tego endpointa do testowania frontendu
 */
export const GET: APIRoute = async ({ url }) => {
  // Symuluj delay sieciowy (opcjonalnie)
  await new Promise((resolve) => setTimeout(resolve, 300));

  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const urgent_only = url.searchParams.get("urgent_only") === "true";
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let data = [...profilesData.profilesWithNeeds];

  // Filtruj po urgent_only
  if (urgent_only) {
    data = data.filter((p) => p.has_urgent_needs);
  }

  // Dodaj distance_km jeśli są współrzędne
  if (lat && lon) {
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);

    data = data.map((profile) => ({
      ...profile,
      distance_km: calculateDistance(userLat, userLon, profile.location.lat, profile.location.lon),
    }));

    // Sortuj po odległości
    data.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
  }

  // Paginacja
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

// Helper: Oblicz odległość (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
