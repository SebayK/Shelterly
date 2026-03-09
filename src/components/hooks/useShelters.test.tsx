// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShelters } from "./useShelters";

function createProfilesResponse(data: unknown[], total = data.length) {
  return {
    data,
    pagination: {
      total,
      limit: 20,
      offset: 0,
    },
  };
}

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("useShelters", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads shelters from the real profiles endpoint on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        createProfilesResponse([
          {
            id: "shelter-1",
            name: "Test Shelter",
            city: "Warsaw",
            location: { lat: 52.2297, lon: 21.0122 },
            has_urgent_needs: false,
            needs_count: 2,
            urgent_needs_count: 0,
          },
        ])
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShelters({ limit: 20 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/profiles?offset=0&limit=20");
    expect(result.current.shelters).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("returns an empty list without an error when the API has no shelters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(createProfilesResponse([], 0)));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShelters({ limit: 20 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shelters).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("exposes an error when the profiles request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Internal error" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useShelters({ limit: 20 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shelters).toEqual([]);
    expect(result.current.error).toBe("Błąd pobierania schronisk: 500");
  });
});
