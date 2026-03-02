import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./logout";

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Creates a minimal Astro context for the logout endpoint.
 * The endpoint takes no request body — only the Authorization header matters,
 * which is handled transparently by Astro middleware.
 */
function buildContext({ supabase }: { supabase?: unknown }) {
  const request = new Request("http://localhost/api/auth/logout", {
    method: "POST",
    headers: { Authorization: "Bearer jwt.access.token" },
  });

  return {
    request,
    locals: { supabase } as Record<string, unknown>,
  } as unknown as Parameters<typeof POST>[0];
}

/**
 * Builds a Supabase mock that simulates auth.getUser + auth.signOut.
 *
 * @param getUserResult  - What `auth.getUser()` resolves to
 * @param signOutResult  - What `auth.signOut()` resolves to
 */
function buildSupabaseMock({
  getUserResult = {
    data: { user: { id: USER_ID } },
    error: null,
  },
  signOutResult = { error: null },
}: {
  getUserResult?: {
    data: { user: { id: string } | null };
    error: { message: string } | null;
  };
  signOutResult?: { error: { message: string } | null };
} = {}) {
  const getUser = vi.fn().mockResolvedValue(getUserResult);
  const signOut = vi.fn().mockResolvedValue(signOutResult);

  return {
    auth: { getUser, signOut },
  } as unknown as import("@/db/supabase.client").SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Missing supabase client
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR when supabase client is not available", async () => {
    const ctx = buildContext({ supabase: undefined });
    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  // -------------------------------------------------------------------------
  // 2. getUser returns an error (missing / invalid / expired token)
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when getUser returns an error", async () => {
    const supabase = buildSupabaseMock({
      getUserResult: {
        data: { user: null },
        error: { message: "JWT expired" },
      },
    });
    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  // -------------------------------------------------------------------------
  // 3. getUser returns user: null (no active session, no explicit error)
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when getUser returns user null without an error", async () => {
    const supabase = buildSupabaseMock({
      getUserResult: { data: { user: null }, error: null },
    });
    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  // -------------------------------------------------------------------------
  // 4. signOut returns an error
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR when signOut returns an error", async () => {
    const supabase = buildSupabaseMock({
      signOutResult: { error: { message: "signOut failed" } },
    });
    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  // -------------------------------------------------------------------------
  // 5. Unexpected exception thrown by the service
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR on unexpected service error", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("Unexpected network error")),
        signOut: vi.fn(),
      },
    } as unknown as import("@/db/supabase.client").SupabaseClient;

    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  // -------------------------------------------------------------------------
  // 6. Successful logout — full response shape validation
  // -------------------------------------------------------------------------

  it("returns 200 OK with correct LogoutResponseDTO on successful logout", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body = await response.json();
    expect(body.message).toBe("Logout successful");
    // Internal user details must NOT be leaked
    expect(JSON.stringify(body)).not.toContain(USER_ID);
  });
});
