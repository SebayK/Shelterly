import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./refresh";
import type { RefreshTokenResponseDTO } from "@/types";

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
 * Creates a minimal Astro context with an optional supabase mock.
 */
function buildContext({
  body = JSON.stringify({ refresh_token: REFRESH_TOKEN }),
  supabase,
}: {
  body?: string | null;
  supabase?: unknown;
}) {
  const request = new Request("http://localhost/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ?? undefined,
  });

  return {
    request,
    locals: { supabase } as Record<string, unknown>,
  } as Parameters<typeof POST>[0];
}

/**
 * Builds a Supabase mock that simulates auth.refreshSession.
 *
 * @param refreshResult - What `refreshSession` resolves to
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
    // createErrorHttpResponse always sanitizes INTERNAL_ERROR messages
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 2. Invalid JSON body
  // -------------------------------------------------------------------------

  it("returns 400 INVALID_REQUEST when body is not valid JSON", async () => {
    const supabase = buildSupabaseMock();
    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const ctx = { request, locals: { supabase } } as Parameters<typeof POST>[0];

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message).toBe("Request body must be valid JSON");
  });

  // -------------------------------------------------------------------------
  // 3. Missing refresh_token field (empty object)
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when refresh_token field is missing", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({}), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "refresh_token")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Empty string refresh_token
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when refresh_token is an empty string", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({ refresh_token: "" }), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "refresh_token")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. refresh_token is not a string (number)
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when refresh_token is not a string", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({ refresh_token: 12345 }), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  // -------------------------------------------------------------------------
  // 6. Supabase returns authError (invalid/expired token)
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
  // 7. Supabase returns session: null without authError
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
  // 8. Unexpected error thrown by service (e.g. network failure)
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
  // 9. Successful refresh — full RefreshTokenResponseDTO validation
  // -------------------------------------------------------------------------

  it("returns 200 OK with correct RefreshTokenResponseDTO on successful refresh", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body: RefreshTokenResponseDTO = await response.json();
    expect(body.access_token).toBe(ACCESS_TOKEN);
    expect(body.expires_at).toBe(EXPIRES_AT);
  });

  // -------------------------------------------------------------------------
  // 10. Response must NOT contain refresh_token
  // -------------------------------------------------------------------------

  it("does not include refresh_token in the response body", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);
    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain("refresh_token");
  });

  // -------------------------------------------------------------------------
  // 11. Response contains exactly access_token and expires_at
  // -------------------------------------------------------------------------

  it("response contains exactly access_token and expires_at fields", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);
    const body = await response.json();

    expect(Object.keys(body)).toEqual(["access_token", "expires_at"]);
  });
});
