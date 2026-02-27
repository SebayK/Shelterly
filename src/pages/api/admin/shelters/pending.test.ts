import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalError } from "@/lib/errors";
import type { PendingShelterListResponseDTO } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";

const PENDING_LIST_RESPONSE: PendingShelterListResponseDTO = {
  data: [
    {
      id: "00000000-0000-0000-0000-000000000099",
      name: "Schronisko XYZ",
      nip: "1234567890",
      city: "Kraków",
      email: "shelter@example.com",
      verification_doc_path: "verification-docs/99/doc.pdf",
      created_at: "2026-01-20T10:00:00Z",
    },
  ],
  pagination: { total: 1, limit: 20, offset: 0 },
};

interface LoadRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  profileRole?: string | null;
  profileError?: { message: string } | null;
  serviceResult?: PendingShelterListResponseDTO;
  serviceError?: Error;
}

async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: ADMIN_USER_ID },
    authError = null,
    profileRole = "super_admin",
    profileError = null,
    serviceResult = PENDING_LIST_RESPONSE,
    serviceError,
  } = options;

  // Build a minimal profile query chain mock
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

  const getPendingShelters = serviceError
    ? vi.fn().mockRejectedValue(serviceError)
    : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/services/admin.service", () => ({
    AdminService: class {
      getPendingShelters = getPendingShelters;
    },
  }));

  const route = await import("./pending");

  return {
    GET: route.GET,
    mocks: { getUser: supabase.auth.getUser, getPendingShelters },
    locals: { supabase },
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/shelters/pending");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return { url, locals: null }; // locals overridden per test
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/shelters/pending", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 401 — Unauthenticated
  // -------------------------------------------------------------------------

  it("returns 401 when user is not authenticated", async () => {
    const { GET, locals } = await loadRoute({ authUser: null, authError: { message: "no session" } });
    const { url } = makeRequest();

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  // -------------------------------------------------------------------------
  // 403 — Wrong role
  // -------------------------------------------------------------------------

  it("returns 403 when authenticated user is not super_admin", async () => {
    const { GET, locals } = await loadRoute({ profileRole: "shelter" });
    const { url } = makeRequest();

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("returns 403 when profile not found (null profile)", async () => {
    const { GET, locals } = await loadRoute({ profileRole: null });
    const { url } = makeRequest();

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // -------------------------------------------------------------------------
  // 400 — Invalid query params
  // -------------------------------------------------------------------------

  it("returns 400 when limit is negative", async () => {
    const { GET, locals } = await loadRoute();
    const { url } = makeRequest({ limit: "-1" });

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when limit exceeds 100", async () => {
    const { GET, locals } = await loadRoute();
    const { url } = makeRequest({ limit: "101" });

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when offset is negative", async () => {
    const { GET, locals } = await loadRoute();
    const { url } = makeRequest({ offset: "-5" });

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns 400 when limit is not a number", async () => {
    const { GET, locals } = await loadRoute();
    const { url } = makeRequest({ limit: "abc" });

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 500 — Internal error
  // -------------------------------------------------------------------------

  it("returns 500 when service throws InternalError", async () => {
    const { GET, locals } = await loadRoute({ serviceError: new InternalError("DB failure") });
    const { url } = makeRequest();

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  // -------------------------------------------------------------------------
  // 200 — Happy path
  // -------------------------------------------------------------------------

  it("returns 200 with PendingShelterListResponseDTO for super_admin", async () => {
    const { GET, locals } = await loadRoute();
    const { url } = makeRequest();

    const response = await GET({ url, locals } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(PENDING_LIST_RESPONSE);
  });

  it("sets Cache-Control: no-store on successful response", async () => {
    const { GET, locals } = await loadRoute();
    const { url } = makeRequest();

    const response = await GET({ url, locals } as never);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes validated limit and offset to the service", async () => {
    const { GET, locals, mocks } = await loadRoute();
    const { url } = makeRequest({ limit: "10", offset: "30" });

    await GET({ url, locals } as never);

    expect(mocks.getPendingShelters).toHaveBeenCalledWith({ limit: 10, offset: 30 });
  });

  it("uses default limit=20 and offset=0 when params are omitted", async () => {
    const { GET, locals, mocks } = await loadRoute();
    const { url } = makeRequest();

    await GET({ url, locals } as never);

    expect(mocks.getPendingShelters).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });
});
