import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./refresh";

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const REFRESH_TOKEN = "valid.refresh.token";
const ACCESS_TOKEN = "new.jwt.access.token";
const EXPIRES_AT = 1234567890;

const SESSION = {
  access_token: ACCESS_TOKEN,
  refresh_token: "new.refresh.token",
  expires_at: EXPIRES_AT,
};

/**
 * Creates a minimal Astro context.
 * Tokens are passed via HttpOnly cookie, not via request body.
 */
function buildContext({
  cookie = `sb-refresh-token=${REFRESH_TOKEN}`,
  supabase,
}: {
  cookie?: string | null;
  supabase?: unknown;
}) {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;

  const request = new Request("http://localhost/api/auth/refresh", {
    method: "POST",
    headers,
  });

  return {
    request,
    locals: { supabase } as Record<string, unknown>,
  } as Parameters<typeof POST>[0];
}

/**
 * Builds a Supabase mock that simulates auth.refreshSession.
 */
function buildSupabaseMock({
  refreshResult = {
    data: { session: SESSION },
    error: null,
  },
}: {
  refreshResult?: {
    data: { session: typeof SESSION | null };
    error: { message: string } | null;
  };
} = {}) {
  const refreshSession = vi.fn().mockResolvedValue(refreshResult);

  return {
    auth: { refreshSession },
  } as unknown as import("@/db/supabase.client").SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Missing supabase client
  // -------------------------------------------------------------------------

  it("returns 500 when supabase client is not available", async () => {
    const ctx = buildContext({ supabase: undefined });
    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 2. Missing sb-refresh-token cookie
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when sb-refresh-token cookie is absent", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ cookie: null, supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  // -------------------------------------------------------------------------
  // 3. Supabase returns authError (invalid/expired token)
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when Supabase returns an authError", async () => {
    const supabase = buildSupabaseMock({
      refreshResult: {
        data: { session: null },
        error: { message: "Invalid Refresh Token" },
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Invalid or expired refresh token");
  });

  // -------------------------------------------------------------------------
  // 4. Supabase returns session: null without authError
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when Supabase returns session: null without error", async () => {
    const supabase = buildSupabaseMock({
      refreshResult: {
        data: { session: null },
        error: null,
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Invalid or expired refresh token");
  });

  // -------------------------------------------------------------------------
  // 5. Unexpected error thrown by service (e.g. network failure)
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR on unexpected service error", async () => {
    const supabase = {
      auth: {
        refreshSession: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    } as unknown as import("@/db/supabase.client").SupabaseClient;

    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 6. Successful refresh — response body contains only expires_at
  // -------------------------------------------------------------------------

  it("returns 200 OK with expires_at in body on successful refresh", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body = await response.json();
    expect(body.expires_at).toBe(EXPIRES_AT);
    // Tokens must not appear in the response body — only in HttpOnly cookies.
    expect(JSON.stringify(body)).not.toContain("access_token");
    expect(JSON.stringify(body)).not.toContain("refresh_token");
    expect(Object.keys(body)).toEqual(["expires_at"]);
  });

  // -------------------------------------------------------------------------
  // 7. Successful refresh — rotated tokens are set as HttpOnly cookies
  // -------------------------------------------------------------------------

  it("sets HttpOnly sb-access-token and sb-refresh-token cookies on successful refresh", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`sb-access-token=${ACCESS_TOKEN}`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`sb-refresh-token=${SESSION.refresh_token}`))).toBe(true);
    // All auth cookies must carry the HttpOnly flag.
    expect(cookies.every((c) => c.toLowerCase().includes("httponly"))).toBe(true);
  });
});
