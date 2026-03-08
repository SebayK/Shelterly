// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateShelterStatus } from "./useUpdateShelterStatus";

const mocks = vi.hoisted(() => ({
  redirectToAdminLogin: vi.fn(),
  redirectToAdminDashboard: vi.fn(),
}));

vi.mock("@/components/admin/request.helpers", async () => {
  const actual = await vi.importActual<typeof import("@/components/admin/request.helpers")>(
    "@/components/admin/request.helpers"
  );

  return {
    ...actual,
    redirectToAdminLogin: mocks.redirectToAdminLogin,
    redirectToAdminDashboard: mocks.redirectToAdminDashboard,
  };
});

describe("useUpdateShelterStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.redirectToAdminLogin.mockClear();
    mocks.redirectToAdminDashboard.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends a verified status update and returns the response DTO", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "shelter-1",
          status: "verified",
          updated_at: "2026-03-07T09:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUpdateShelterStatus());

    await act(async () => {
      const response = await result.current.updateStatus({
        shelterId: "shelter-1",
        command: { status: "verified" },
      });

      expect(response.status).toBe("verified");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/shelters/shelter-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "verified" }),
      })
    );
    expect(result.current.errorMessage).toBeNull();
  });

  it("stores validation error text when rejected status payload is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request data",
              details: [{ field: "rejection_reason", message: "Rejection reason must be at least 3 characters" }],
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const { result } = renderHook(() => useUpdateShelterStatus());

    await act(async () => {
      await expect(
        result.current.updateStatus({
          shelterId: "shelter-1",
          command: { status: "rejected", rejection_reason: "ab" },
        })
      ).rejects.toThrow("Rejection reason must be at least 3 characters");
    });

    expect(result.current.errorMessage).toBe("Rejection reason must be at least 3 characters");
  });

  it("redirects to admin login when the mutation returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { result } = renderHook(() => useUpdateShelterStatus());

    await act(async () => {
      await expect(
        result.current.updateStatus({
          shelterId: "shelter-1",
          command: { status: "verified" },
        })
      ).rejects.toThrow("Sesja wygasła. Zaloguj się ponownie.");
    });

    expect(mocks.redirectToAdminLogin).toHaveBeenCalledTimes(1);
  });

  it("redirects to dashboard when the mutation returns 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", message: "Access restricted to super administrators" } }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const { result } = renderHook(() => useUpdateShelterStatus());

    await act(async () => {
      await expect(
        result.current.updateStatus({
          shelterId: "shelter-1",
          command: { status: "verified" },
        })
      ).rejects.toThrow("Brak uprawnień do panelu administracyjnego.");
    });

    expect(mocks.redirectToAdminDashboard).toHaveBeenCalledTimes(1);
    expect(result.current.errorMessage).toBe("Brak uprawnień do panelu administracyjnego.");
  });
});
