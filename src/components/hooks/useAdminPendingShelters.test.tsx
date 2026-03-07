// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminPendingShelters } from "./useAdminPendingShelters";

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

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("useAdminPendingShelters", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.redirectToAdminLogin.mockClear();
    mocks.redirectToAdminDashboard.mockClear();
  });

  it("redirects to login when the pending shelters endpoint returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          createJsonResponse({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 })
        )
    );

    const { result } = renderHook(() => useAdminPendingShelters({ page: 1, pageSize: 10 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mocks.redirectToAdminLogin).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("Sesja wygasła. Zaloguj się ponownie.");
  });

  it("redirects to dashboard when the pending shelters endpoint returns 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          createJsonResponse(
            { error: { code: "FORBIDDEN", message: "Access restricted to super administrators" } },
            { status: 403 }
          )
        )
    );

    const { result } = renderHook(() => useAdminPendingShelters({ page: 1, pageSize: 10 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mocks.redirectToAdminDashboard).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("Brak uprawnień do panelu administracyjnego.");
  });
});
