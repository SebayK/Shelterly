// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNeeds } from "./useNeeds";

function createNeedListResponse(total: number, page: number) {
  return {
    data: [
      {
        id: `need-${page}`,
        shelter_id: "shelter-1",
        category: "food",
        title: `Need ${page}`,
        description: null,
        shopping_url: null,
        urgency: "normal",
        target_quantity: 10,
        current_quantity: page,
        unit: "pcs",
        is_fulfilled: false,
        progress_percentage: 10,
        created_at: "2026-03-01T12:00:00Z",
        updated_at: "2026-03-01T12:00:00Z",
      },
    ],
    pagination: {
      total,
      limit: 10,
      offset: (page - 1) * 10,
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

describe("useNeeds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the first page of needs on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(createNeedListResponse(12, 1)));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNeeds("shelter-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/needs?shelter_id=shelter-1&limit=10&offset=0", expect.any(Object));
    expect(result.current.needs).toHaveLength(1);
    expect(result.current.needs[0]?.title).toBe("Need 1");
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("ignores stale responses when a newer request wins", async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveSecond: ((value: Response) => void) | undefined;
    let callIndex = 0;

    const firstRequest = new Promise<Response>((_, reject) => {
      const abortHandler = () => reject(new DOMException("Aborted", "AbortError"));

      queueMicrotask(() => {
        firstSignal?.addEventListener("abort", abortHandler, { once: true });
      });
    });

    const secondRequest = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });

    const fetchMock = vi.fn((_: string, init?: RequestInit) => {
      callIndex += 1;

      if (callIndex === 1) {
        firstSignal = init?.signal as AbortSignal | undefined;
        return firstRequest;
      }

      return secondRequest;
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNeeds("shelter-1"));

    await act(async () => {
      const pendingFetch = result.current.fetchNeeds(2);
      resolveSecond?.(createJsonResponse(createNeedListResponse(20, 2)));
      await pendingFetch;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.needs[0]?.title).toBe("Need 2");
    expect(firstSignal?.aborted).toBe(true);
  });

  it("returns a local error when shelter id is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNeeds(""));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Brakuje identyfikatora schroniska.");
    expect(result.current.needs).toEqual([]);
  });
});
