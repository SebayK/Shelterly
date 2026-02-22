import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShelterStatusUpdateResponseDTO } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";
const SHELTER_ID = "00000000-0000-0000-0000-000000000099";

const SUCCESS_RESPONSE: ShelterStatusUpdateResponseDTO = {
  id: SHELTER_ID,
  status: "verified",
  updated_at: "2026-02-22T12:00:00Z",
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
  serviceResult?: ShelterStatusUpdateResponseDTO;
  serviceErrorClass?: ServiceErrorClass;
  serviceErrorMessage?: string;
}

async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: ADMIN_USER_ID },
    authError = null,
    profileRole = "super_admin",
    profileError = null,
    serviceResult = SUCCESS_RESPONSE,
    serviceErrorClass,
    serviceErrorMessage,
  } = options;

  // Build service error from fresh dynamic import to avoid instanceof mismatch
  // caused by vi.resetModules() creating separate module instances.
  let serviceError: Error | undefined;
  if (serviceErrorClass) {
    const errors = await import("@/lib/errors");
    if (serviceErrorClass === "NotFoundError")
      serviceError = new errors.NotFoundError(serviceErrorMessage ?? "Shelter not found");
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

  const updateShelterStatus = serviceError
    ? vi.fn().mockRejectedValue(serviceError)
    : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/services/admin.service", () => ({
    AdminService: class {
      updateShelterStatus = updateShelterStatus;
    },
  }));

  const route = await import("./status");

  return {
    PATCH: route.PATCH,
    mocks: { getUser: supabase.auth.getUser, updateShelterStatus },
    locals: { supabase },
  };
}

function makeRequest(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  };
}

function makeMalformedRequest() {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/shelters/:id/status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 400 — Path param validation
  // -------------------------------------------------------------------------

  it("returns 400 when :id is not a valid UUID", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: "not-a-uuid" },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 400 — Body validation
  // -------------------------------------------------------------------------

  it("returns 400 when request body is malformed JSON", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeMalformedRequest(),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("returns 400 when status field is missing", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({}),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when status is an invalid value", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "pending" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when status is 'rejected' but rejection_reason is missing", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "rejected" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when rejection_reason is provided for a non-rejected status", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified", rejection_reason: "some reason" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when rejection_reason is too short (< 3 chars)", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "rejected", rejection_reason: "ab" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 401 — Unauthenticated
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    const { PATCH, locals } = await loadRoute({ authUser: null, authError: { message: "no session" } });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  // -------------------------------------------------------------------------
  // 403 — Wrong role
  // -------------------------------------------------------------------------

  it("returns 403 when authenticated user is not super_admin", async () => {
    const { PATCH, locals } = await loadRoute({ profileRole: "shelter" });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 403 when profile is not found (null)", async () => {
    const { PATCH, locals } = await loadRoute({ profileRole: null });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // -------------------------------------------------------------------------
  // 404 — Shelter not found
  // -------------------------------------------------------------------------

  it("returns 404 when service throws NotFoundError", async () => {
    const { PATCH, locals } = await loadRoute({ serviceErrorClass: "NotFoundError" });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Internal error
  // -------------------------------------------------------------------------

  it("returns 500 when service throws InternalError", async () => {
    const { PATCH, locals } = await loadRoute({ serviceErrorClass: "InternalError" });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("returns 500 on unexpected error", async () => {
    const { PATCH, locals } = await loadRoute({ serviceErrorClass: "Error" });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 200 — Happy path
  // -------------------------------------------------------------------------

  it("returns 200 with ShelterStatusUpdateResponseDTO for valid verified request", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(SUCCESS_RESPONSE);
  });

  it("returns 200 with rejected status and rejection_reason provided", async () => {
    const { PATCH, locals, mocks } = await loadRoute({
      serviceResult: { id: SHELTER_ID, status: "rejected", updated_at: "2026-02-22T12:00:00Z" },
    });

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "rejected", rejection_reason: "Documents are invalid" }),
      locals,
    } as never);

    expect(response.status).toBe(200);
    expect(mocks.updateShelterStatus).toHaveBeenCalledWith(SHELTER_ID, {
      status: "rejected",
      rejection_reason: "Documents are invalid",
    });
  });

  it("sets Cache-Control: no-store on successful response", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("calls service with correct shelter ID and command", async () => {
    const { PATCH, locals, mocks } = await loadRoute();

    await PATCH({
      params: { id: SHELTER_ID },
      request: makeRequest({ status: "verified" }),
      locals,
    } as never);

    expect(mocks.updateShelterStatus).toHaveBeenCalledWith(SHELTER_ID, { status: "verified" });
  });
});
