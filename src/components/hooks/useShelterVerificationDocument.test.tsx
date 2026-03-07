// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShelterVerificationDocument } from "./useShelterVerificationDocument";

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

const createObjectUrlMock = vi.fn(() => "blob:mock-url");
const revokeObjectUrlMock = vi.fn();

describe("useShelterVerificationDocument", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.redirectToAdminLogin.mockClear();
    mocks.redirectToAdminDashboard.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads a PDF document and exposes a previewable state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename*=UTF-8''verification.pdf",
      }),
      blob: vi.fn().mockResolvedValue(new Blob(["pdf-binary"], { type: "application/pdf" })),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useShelterVerificationDocument({
        shelterId: "shelter-1",
        verificationDocumentPath: "docs/verification.pdf",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.documentState.status).toBe("success");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/shelters/shelter-1/verification-document",
      expect.objectContaining({ method: "GET", signal: expect.any(AbortSignal) })
    );
    expect(result.current.documentState.fileName).toBe("verification.pdf");
    expect(result.current.documentState.objectUrl).toBe("blob:mock-url");
  });

  it("marks missing document path as missing without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useShelterVerificationDocument({
        shelterId: "shelter-1",
        verificationDocumentPath: null,
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.documentState.status).toBe("missing");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries the document request after a previous failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "boom" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename*=UTF-8''retry.pdf",
        }),
        blob: vi.fn().mockResolvedValue(new Blob(["pdf-binary"], { type: "application/pdf" })),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useShelterVerificationDocument({
        shelterId: "shelter-1",
        verificationDocumentPath: "docs/retry.pdf",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.documentState.status).toBe("error");
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.documentState.status).toBe("success");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("redirects to admin login when the document endpoint returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    renderHook(() =>
      useShelterVerificationDocument({
        shelterId: "shelter-1",
        verificationDocumentPath: "docs/verification.pdf",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mocks.redirectToAdminLogin).toHaveBeenCalledTimes(1);
    });
  });

  it("redirects to dashboard when the document endpoint returns 403", async () => {
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

    renderHook(() =>
      useShelterVerificationDocument({
        shelterId: "shelter-1",
        verificationDocumentPath: "docs/verification.pdf",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(mocks.redirectToAdminDashboard).toHaveBeenCalledTimes(1);
    });
  });
});
