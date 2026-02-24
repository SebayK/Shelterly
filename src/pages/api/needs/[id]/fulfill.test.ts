import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NeedFulfillResponseDTO } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEED_ID = "00000000-0000-0000-0000-000000000099";
const USER_ID = "00000000-0000-0000-0000-000000000001";

const SUCCESS_RESPONSE: NeedFulfillResponseDTO = {
  id: NEED_ID,
  is_fulfilled: true,
  updated_at: "2026-02-24T10:00:00Z",
};

// ---------------------------------------------------------------------------
// Route loader
// ---------------------------------------------------------------------------

type ServiceErrorClass = "NotFoundError" | "ForbiddenError" | "InternalError" | "Error";

interface LoadRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  supabase?: object | null;
  serviceResult?: NeedFulfillResponseDTO;
  serviceErrorClass?: ServiceErrorClass;
  serviceErrorMessage?: string;
}

/**
 * Dynamically imports the route module with mocked dependencies.
 * vi.resetModules() is called in beforeEach so each test gets a fresh module.
 */
async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: USER_ID },
    authError = null,
    supabase: overrideSupabase,
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

  const fulfillNeed = serviceError ? vi.fn().mockRejectedValue(serviceError) : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/services/needs.service", () => ({
    NeedsService: class {
      fulfillNeed = fulfillNeed;
    },
  }));

  const route = await import("./fulfill");

  return {
    POST: route.POST,
    mocks: { getUser: (supabase as { auth: { getUser: ReturnType<typeof vi.fn> } })?.auth?.getUser, fulfillNeed },
    locals: { supabase },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/needs/:id/fulfill", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 400 — Validation
  // -------------------------------------------------------------------------

  it("returns 400 when :id is not a valid UUID", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      params: { id: "not-a-uuid" },
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when :id is empty string", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      params: { id: "" },
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Missing Supabase client
  // -------------------------------------------------------------------------

  it("returns 500 when supabase client is not available", async () => {
    const { POST } = await loadRoute({ supabase: null });

    const response = await POST({
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
    const { POST, locals } = await loadRoute({ authUser: null, authError: { message: "no session" } });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("returns 401 when user object is null without error", async () => {
    const { POST, locals } = await loadRoute({ authUser: null });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  // -------------------------------------------------------------------------
  // 404 — Not found / already fulfilled
  // -------------------------------------------------------------------------

  it("returns 404 when service throws NotFoundError (need missing)", async () => {
    const { POST, locals } = await loadRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Need not found",
    });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns 404 when service throws NotFoundError (already fulfilled)", async () => {
    const { POST, locals } = await loadRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Need is already fulfilled",
    });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND", message: "Need is already fulfilled" },
    });
  });

  // -------------------------------------------------------------------------
  // 403 — Forbidden
  // -------------------------------------------------------------------------

  it("returns 403 when service throws ForbiddenError", async () => {
    const { POST, locals } = await loadRoute({ serviceErrorClass: "ForbiddenError" });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Internal / unexpected errors
  // -------------------------------------------------------------------------

  it("returns 500 when service throws InternalError", async () => {
    const { POST, locals } = await loadRoute({ serviceErrorClass: "InternalError" });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("returns 500 on unexpected (non-domain) error", async () => {
    const { POST, locals } = await loadRoute({ serviceErrorClass: "Error" });

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 200 — Happy path
  // -------------------------------------------------------------------------

  it("returns 200 with NeedFulfillResponseDTO on success", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(SUCCESS_RESPONSE);
  });

  it("calls service with correct needId and userId", async () => {
    const { POST, locals, mocks } = await loadRoute();

    await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(mocks.fulfillNeed).toHaveBeenCalledWith(NEED_ID, USER_ID);
  });

  it("returns JSON with Content-Type application/json", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      params: { id: NEED_ID },
      locals,
    } as never);

    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});
