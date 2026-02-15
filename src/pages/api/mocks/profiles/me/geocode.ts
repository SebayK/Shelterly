import type { APIRoute } from "astro";

export const prerender = false;

/**
 * MOCK ENDPOINT: POST /api/mocks/profiles/me/geocode
 * Simulates address geocoding
 */
export const POST: APIRoute = async ({ request }) => {
  // Disable in production
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

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

  const { address } = body;

  if (!address || address.trim().length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: [
            {
              field: "address",
              message: "Address must not be empty",
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

  // Mockowane odpowiedzi dla różnych adresów
  const mockResults: Record<string, { location: { lat: number; lon: number }; formatted_address: string }> = {
    "ul. Marszałkowska 1, Warszawa": {
      location: { lat: 52.229676, lon: 21.012229 },
      formatted_address: "Marszałkowska 1, Śródmieście, Warszawa, województwo mazowieckie, 00-624, Polska",
    },
    "ul. Floriańska 1, 31-019 Kraków": {
      location: { lat: 50.062006, lon: 19.937167 },
      formatted_address: "Floriańska 1, Stare Miasto, Kraków, województwo małopolskie, 31-019, Polska",
    },
    "ul. Długa 1, Gdańsk": {
      location: { lat: 54.348863, lon: 18.653524 },
      formatted_address: "Długa 1, Śródmieście, Gdańsk, województwo pomorskie, 80-827, Polska",
    },
  };

  // Znajdź najbliższe dopasowanie
  const normalizedAddress = address.toLowerCase();
  const match = Object.keys(mockResults).find((key) => normalizedAddress.includes(key.toLowerCase().split(",")[0]));

  if (match) {
    return new Response(JSON.stringify(mockResults[match]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Domyślna odpowiedź dla nieznanych adresów (Warszawa centrum)
  if (!normalizedAddress.includes("nieistniejąc")) {
    return new Response(
      JSON.stringify({
        location: { lat: 52.2297, lon: 21.0122 },
        formatted_address: `${address}, Warszawa, Polska`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Adres nie znaleziony
  return new Response(
    JSON.stringify({
      error: {
        code: "NOT_FOUND",
        message: "Address not found by geocoding service",
      },
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }
  );
};
