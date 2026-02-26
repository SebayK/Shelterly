import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NeedDeleteResponseDTO, NeedUpdateResponseDTO } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEED_ID = "00000000-0000-0000-0000-000000000099";
const USER_ID = "00000000-0000-0000-0000-000000000001";

const SUCCESS_RESPONSE: NeedUpdateResponseDTO = {
  id: NEED_ID,
  title: "Updated title",
  description: "Updated description",
  urgency: "high",
  current_quantity: 25,
  progress_percentage: 25,
  updated_at: "2026-02-24T11:00:00Z",
};

const VERIFIED_PROFILE = { id: USER_ID, role: "shelter", status: "verified" };

// ---------------------------------------------------------------------------
// Route loader
// ---------------------------------------------------------------------------

type ServiceErrorClass = "NotFoundError" | "ForbiddenError" | "ValidationError" | "InternalError" | "Error";

interface LoadRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  supabase?: object | null;
  profile?: object | null;
  profileError?: { message: string } | null;
  serviceResult?: NeedUpdateResponseDTO;
  serviceErrorClass?: ServiceErrorClass;
  serviceErrorMessage?: string;
}

/**
 * Dynamically imports the PATCH route handler with mocked dependencies.
 * vi.resetModules() is called in beforeEach so each test gets a fresh module.
 */
async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: USER_ID },
    authError = null,
    supabase: overrideSupabase,
    profile = VERIFIED_PROFILE,
    profileError = null,
    serviceResult = SUCCESS_RESPONSE,
    serviceErrorClass,
    serviceErrorMessage,
  } = options;

  // Build service error from fresh dynamic import to avoid instanceof mismatches
  // caused by vi.resetModules() creating separate module instances.
  let serviceError: Error | undefined;
  if (serviceErrorClass) {
    const errors = await import("@/lib/errors");
    if (serviceErrorClass === "NotFoundError")
      serviceError = new errors.NotFoundError(serviceErrorMessage ?? "Need not found");
    else if (serviceErrorClass === "ForbiddenError")
      serviceError = new errors.ForbiddenError(serviceErrorMessage ?? "You are not the owner of this need");
    else if (serviceErrorClass === "ValidationError")
      serviceError = new errors.ValidationError(serviceErrorMessage ?? "current_quantity must be <= target_quantity");
    else if (serviceErrorClass === "InternalError")
      serviceError = new errors.InternalError(serviceErrorMessage ?? "DB failure");
    else serviceError = new Error(serviceErrorMessage ?? "unexpected");
  }

  // Profile query mock: .from("profiles").select().eq().maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: profileError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const selectProfile = vi.fn().mockReturnValue({ eq });
  const fromProfiles = vi.fn().mockReturnValue({ select: selectProfile });

  const supabase =
    overrideSupabase !== undefined
      ? overrideSupabase
      : {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: authUser },
              error: authError,
            }),
          },
          from: fromProfiles,
        };

  const updateNeed = serviceError ? vi.fn().mockRejectedValue(serviceError) : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/services/needs.service", () => ({
    NeedsService: class {
      updateNeed = updateNeed;
    },
  }));

  const route = await import("./index");

  return {
    PATCH: route.PATCH,
    mocks: {
      getUser: (supabase as { auth: { getUser: ReturnType<typeof vi.fn> } })?.auth?.getUser,
      updateNeed,
    },
    locals: { supabase },
  };
}

/** Creates a minimal Request with a JSON body */
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/needs/" + NEED_ID, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/needs/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 400 — UUID validation
  // -------------------------------------------------------------------------

  it("returns 400 when :id is not a valid UUID", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: "not-a-uuid" },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when :id is an empty string", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: "" },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Missing Supabase client
  // -------------------------------------------------------------------------

  it("returns 500 when supabase client is not available", async () => {
    const { PATCH } = await loadRoute({ supabase: null });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals: { supabase: null },
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 401 — Unauthenticated
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated (auth error)", async () => {
    const { PATCH, locals } = await loadRoute({ authUser: null, authError: { message: "no session" } });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 when user object is null without error", async () => {
    const { PATCH, locals } = await loadRoute({ authUser: null });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  // -------------------------------------------------------------------------
  // 404 — Profile not found
  // -------------------------------------------------------------------------

  it("returns 404 when shelter profile does not exist", async () => {
    const { PATCH, locals } = await loadRoute({ profile: null });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  // -------------------------------------------------------------------------
  // 403 — Role and status checks
  // -------------------------------------------------------------------------

  it("returns 403 FORBIDDEN when user role is super_admin", async () => {
    const { PATCH, locals } = await loadRoute({
      profile: { ...VERIFIED_PROFILE, role: "super_admin" },
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 403 ACCOUNT_PENDING when shelter status is pending", async () => {
    const { PATCH, locals } = await loadRoute({
      profile: { ...VERIFIED_PROFILE, status: "pending" },
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "ACCOUNT_PENDING" } });
  });

  it("returns 403 FORBIDDEN when shelter status is suspended", async () => {
    const { PATCH, locals } = await loadRoute({
      profile: { ...VERIFIED_PROFILE, status: "suspended" },
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 403 FORBIDDEN when shelter status is rejected", async () => {
    const { PATCH, locals } = await loadRoute({
      profile: { ...VERIFIED_PROFILE, status: "rejected" },
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // -------------------------------------------------------------------------
  // 400 — Invalid JSON / body validation
  // -------------------------------------------------------------------------

  it("returns 400 INVALID_REQUEST when body is not valid JSON", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: NEED_ID },
      request: new Request("http://localhost/api/needs/" + NEED_ID, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("returns 400 VALIDATION_ERROR when body is an empty object", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({}),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 VALIDATION_ERROR for invalid urgency value", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ urgency: "extreme" }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 VALIDATION_ERROR when current_quantity > target_quantity in body", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ current_quantity: 200, target_quantity: 100 }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // Service-layer error mapping
  // -------------------------------------------------------------------------

  it("returns 404 when service throws NotFoundError", async () => {
    const { PATCH, locals } = await loadRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Need not found",
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns 403 when service throws ForbiddenError", async () => {
    const { PATCH, locals } = await loadRoute({
      serviceErrorClass: "ForbiddenError",
      serviceErrorMessage: "You are not the owner of this need",
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 400 VALIDATION_ERROR when service throws ValidationError (quantity mismatch with DB)", async () => {
    const { PATCH, locals } = await loadRoute({
      serviceErrorClass: "ValidationError",
      serviceErrorMessage: "current_quantity must be less than or equal to target_quantity",
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ current_quantity: 120 }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 500 when service throws InternalError", async () => {
    const { PATCH, locals } = await loadRoute({
      serviceErrorClass: "InternalError",
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("returns 500 for unexpected errors", async () => {
    const { PATCH, locals } = await loadRoute({
      serviceErrorClass: "Error",
      serviceErrorMessage: "unexpected boom",
    });

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "New title" }),
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 200 — Success
  // -------------------------------------------------------------------------

  it("returns 200 with NeedUpdateResponseDTO on success", async () => {
    const { PATCH, locals } = await loadRoute();

    const response = await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "Updated title", urgency: "high", current_quantity: 25 }),
      locals,
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(SUCCESS_RESPONSE);
  });

  it("calls updateNeed with correct need id and user id", async () => {
    const { PATCH, locals, mocks } = await loadRoute();

    await PATCH({
      params: { id: NEED_ID },
      request: makeRequest({ title: "Updated title" }),
      locals,
    } as never);

    expect(mocks.updateNeed).toHaveBeenCalledWith(
      NEED_ID,
      USER_ID,
      expect.objectContaining({ title: "Updated title" })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/needs/:id
// ---------------------------------------------------------------------------

const DELETE_SUCCESS_RESPONSE: NeedDeleteResponseDTO = {
  message: "Need successfully deleted",
  deleted_at: "2026-02-26T12:00:00Z",
};

type DeleteServiceErrorClass = "NotFoundError" | "ForbiddenError" | "InternalError" | "Error";

interface LoadDeleteRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  supabase?: object | null;
  serviceResult?: NeedDeleteResponseDTO;
  serviceErrorClass?: DeleteServiceErrorClass;
  serviceErrorMessage?: string;
}

/**
 * Dynamically imports the DELETE route handler with mocked dependencies.
 * The DELETE handler is simpler than PATCH — no profile lookup is needed;
 * ownership is verified inside the service layer.
 */
async function loadDeleteRoute(options: LoadDeleteRouteOptions = {}) {
  const {
    authUser = { id: USER_ID },
    authError = null,
    supabase: overrideSupabase,
    serviceResult = DELETE_SUCCESS_RESPONSE,
    serviceErrorClass,
    serviceErrorMessage,
  } = options;

  let serviceError: Error | undefined;
  if (serviceErrorClass) {
    const errors = await import("@/lib/errors");
    if (serviceErrorClass === "NotFoundError")
      serviceError = new errors.NotFoundError(serviceErrorMessage ?? "Need not found");
    else if (serviceErrorClass === "ForbiddenError")
      serviceError = new errors.ForbiddenError(serviceErrorMessage ?? "You are not the owner of this need");
    else if (serviceErrorClass === "InternalError")
      serviceError = new errors.InternalError(serviceErrorMessage ?? "DB failure");
    else serviceError = new Error(serviceErrorMessage ?? "unexpected");
  }

  const supabase =
    overrideSupabase !== undefined
      ? overrideSupabase
      : {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: authUser },
              error: authError,
            }),
          },
        };

  const deleteNeed = serviceError
    ? vi.fn().mockRejectedValue(serviceError)
    : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/services/needs.service", () => ({
    NeedsService: class {
      deleteNeed = deleteNeed;
    },
  }));

  const route = await import("./index");

  return {
    DELETE: route.DELETE,
    mocks: {
      getUser: (supabase as { auth: { getUser: ReturnType<typeof vi.fn> } })?.auth?.getUser,
      deleteNeed,
    },
    locals: { supabase },
  };
}

describe("DELETE /api/needs/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 400 — UUID validation
  // -------------------------------------------------------------------------

  it("returns 400 when :id is not a valid UUID", async () => {
    const { DELETE, locals } = await loadDeleteRoute();

    const response = await DELETE({
      params: { id: "not-a-uuid" },
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Missing Supabase client
  // -------------------------------------------------------------------------

  it("returns 500 when supabase client is not available", async () => {
    const { DELETE } = await loadDeleteRoute({ supabase: null });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals: { supabase: null },
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 401 — Unauthenticated
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated (auth error)", async () => {
    const { DELETE, locals } = await loadDeleteRoute({
      authUser: null,
      authError: { message: "no session" },
    });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 when user object is null without error", async () => {
    const { DELETE, locals } = await loadDeleteRoute({ authUser: null });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  // -------------------------------------------------------------------------
  // Service-layer error mapping
  // -------------------------------------------------------------------------

  it("returns 404 when service throws NotFoundError", async () => {
    const { DELETE, locals } = await loadDeleteRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Need not found",
    });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns 403 when service throws ForbiddenError", async () => {
    const { DELETE, locals } = await loadDeleteRoute({
      serviceErrorClass: "ForbiddenError",
      serviceErrorMessage: "You are not the owner of this need",
    });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 500 when service throws InternalError", async () => {
    const { DELETE, locals } = await loadDeleteRoute({ serviceErrorClass: "InternalError" });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("returns 500 for unexpected errors", async () => {
    const { DELETE, locals } = await loadDeleteRoute({
      serviceErrorClass: "Error",
      serviceErrorMessage: "unexpected boom",
    });

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 200 — Success
  // -------------------------------------------------------------------------

  it("returns 200 with NeedDeleteResponseDTO on success", async () => {
    const { DELETE, locals } = await loadDeleteRoute();

    const response = await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(DELETE_SUCCESS_RESPONSE);
  });

  it("calls deleteNeed with correct need id and user id", async () => {
    const { DELETE, locals, mocks } = await loadDeleteRoute();

    await DELETE({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(mocks.deleteNeed).toHaveBeenCalledWith(NEED_ID, USER_ID);
  });
});
