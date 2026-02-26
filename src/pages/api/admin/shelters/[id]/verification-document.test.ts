import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerificationDocumentResult } from "@/lib/services/admin.service";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";
const SHELTER_ID = "00000000-0000-0000-0000-000000000099";

const SUCCESS_RESULT: VerificationDocumentResult = {
  data: new Blob(["PDF content"], { type: "application/pdf" }),
  fileName: "document.pdf",
  contentType: "application/pdf",
};

// ---------------------------------------------------------------------------
// Route loader
// ---------------------------------------------------------------------------

type ServiceErrorClass = "NotFoundError" | "InternalError" | "Error";

interface LoadRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  profileRole?: string | null;
  profileError?: { message: string } | null;
  serviceResult?: VerificationDocumentResult;
  serviceErrorClass?: ServiceErrorClass;
  serviceErrorMessage?: string;
}

async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: ADMIN_USER_ID },
    authError = null,
    profileRole = "super_admin",
    profileError = null,
    serviceResult = SUCCESS_RESULT,
    serviceErrorClass,
    serviceErrorMessage,
  } = options;

  // Build service error from a fresh dynamic import to avoid instanceof mismatch
  // caused by vi.resetModules() creating separate module instances.
  let serviceError: Error | undefined;
  if (serviceErrorClass) {
    const errors = await import("@/lib/errors");
    if (serviceErrorClass === "NotFoundError")
      serviceError = new errors.NotFoundError(serviceErrorMessage ?? "Not found");
    else if (serviceErrorClass === "InternalError")
      serviceError = new errors.InternalError(serviceErrorMessage ?? "DB failure");
    else serviceError = new Error(serviceErrorMessage ?? "unexpected");
  }

  // Supabase from() chain for role check
  const maybeSingle = vi.fn().mockResolvedValue({
    data: profileRole !== null ? { role: profileRole } : null,
    error: profileError,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },
    from,
  };

  const getVerificationDocument = serviceError
    ? vi.fn().mockRejectedValue(serviceError)
    : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/services/admin.service", () => ({
    AdminService: class {
      getVerificationDocument = getVerificationDocument;
    },
  }));

  const route = await import("./verification-document");

  return {
    GET: route.GET,
    mocks: { getUser: supabase.auth.getUser, getVerificationDocument },
    locals: { supabase },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/shelters/:id/verification-document", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 400 — Path param validation
  // -------------------------------------------------------------------------

  it("returns 400 when :id is not a valid UUID", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: { id: "not-a-uuid" },
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when :id is missing", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: {},
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 401 — Unauthenticated
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated (authError present)", async () => {
    const { GET, locals } = await loadRoute({ authUser: null, authError: { message: "no session" } });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 when user is null without error", async () => {
    const { GET, locals } = await loadRoute({ authUser: null });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  // -------------------------------------------------------------------------
  // 403 — Wrong role
  // -------------------------------------------------------------------------

  it("returns 403 when authenticated user is not super_admin", async () => {
    const { GET, locals } = await loadRoute({ profileRole: "shelter" });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 403 when profile record is null", async () => {
    const { GET, locals } = await loadRoute({ profileRole: null });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // -------------------------------------------------------------------------
  // 404 — Shelter or document not found
  // -------------------------------------------------------------------------

  it("returns 404 when service throws NotFoundError (shelter missing)", async () => {
    const { GET, locals } = await loadRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Shelter not found",
    });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns 404 when service throws NotFoundError (document missing)", async () => {
    const { GET, locals } = await loadRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Verification document not found",
    });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Internal errors
  // -------------------------------------------------------------------------

  it("returns 500 when service throws InternalError", async () => {
    const { GET, locals } = await loadRoute({ serviceErrorClass: "InternalError" });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("returns 500 on unexpected error", async () => {
    const { GET, locals } = await loadRoute({ serviceErrorClass: "Error" });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 200 — Happy path
  // -------------------------------------------------------------------------

  it("returns 200 on valid request", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(200);
  });

  it("sets Content-Type header matching the document mime type", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("sets Content-Disposition: attachment with the correct filename", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    const cd = response.headers.get("Content-Disposition") || "";
    expect(cd).toContain("attachment;");
    // Implementation uses RFC5987 filename*=UTF-8'' encoding; accept either form
    expect(cd.includes("filename*=UTF-8") || cd.includes('filename="document.pdf"')).toBe(true);
  });

  it("sets Cache-Control: no-store on successful response", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets X-Content-Type-Options: nosniff on successful response", async () => {
    const { GET, locals } = await loadRoute();

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("calls service with the correct shelter ID", async () => {
    const { GET, locals, mocks } = await loadRoute();

    await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(mocks.getVerificationDocument).toHaveBeenCalledWith(SHELTER_ID);
  });

  it("returns image/jpeg Content-Type when service resolves with jpeg file", async () => {
    const { GET, locals } = await loadRoute({
      serviceResult: {
        data: new Blob(["JPEG content"]),
        fileName: "photo.jpg",
        contentType: "image/jpeg",
      },
    });

    const response = await GET({
      params: { id: SHELTER_ID },
      locals,
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    const cd2 = response.headers.get("Content-Disposition") || "";
    expect(cd2).toContain("attachment;");
    expect(cd2.includes("filename*=UTF-8") || cd2.includes('filename="photo.jpg"')).toBe(true);
  });
});
