import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./login";
import type { ShelterStatus, UserRole } from "@/types";

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const USER_ID = "00000000-0000-0000-0000-000000000001";
const USER_EMAIL = "shelter@example.com";
const PASSWORD = "SecureP@ssw0rd";

const PROFILE = { id: USER_ID, status: "verified" as const, role: "shelter" as const };

const SESSION = {
  access_token: "jwt.access.token",
  refresh_token: "jwt.refresh.token",
  expires_at: 1234567890,
};

/**
 * Creates a minimal Astro context with an optional supabase mock.
 */
function buildContext({
  body = JSON.stringify({ email: USER_EMAIL, password: PASSWORD }),
  supabase,
}: {
  body?: string | null;
  supabase?: unknown;
}) {
  const request = new Request("http://localhost/api/auth/login", {
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
 * Builds a Supabase mock that simulates signInWithPassword + profile SELECT.
 *
 * @param authResult  - What `signInWithPassword` resolves to
 * @param profileResult - What `.from("profiles").select(...).eq(...).maybeSingle()` resolves to
 */
interface ProfileData {
  id: string;
  status: ShelterStatus;
  role: UserRole;
}

function buildSupabaseMock({
  authResult = { data: { user: { id: USER_ID, email: USER_EMAIL }, session: SESSION }, error: null },
  profileResult = { data: PROFILE as ProfileData, error: null },
  signOutResult = { error: null },
}: {
  authResult?: {
    data: { user: { id: string; email: string } | null; session: typeof SESSION | null };
    error: { message: string } | null;
  };
  profileResult?: { data: ProfileData | null; error: { message: string } | null };
  signOutResult?: { error: { message: string } | null };
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const signInWithPassword = vi.fn().mockResolvedValue(authResult);
  // signOut is called by login() when the account status is pending or suspended,
  // to invalidate the session before throwing the domain error.
  const signOut = vi.fn().mockResolvedValue(signOutResult);

  return {
    from,
    auth: { signInWithPassword, signOut },
  } as unknown as import("@/db/supabase.client").SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/login", () => {
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
  });

  // -------------------------------------------------------------------------
  // 2. Invalid JSON body
  // -------------------------------------------------------------------------

  it("returns 400 INVALID_REQUEST when body is not valid JSON", async () => {
    const supabase = buildSupabaseMock();
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const ctx = { request, locals: { supabase } } as Parameters<typeof POST>[0];

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  // -------------------------------------------------------------------------
  // 3. Missing email field
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when email is missing", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({ password: PASSWORD }), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "email")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Missing password field
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when password is missing", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({ email: USER_EMAIL }), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "password")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Empty body
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when body is empty object", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({}), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  // -------------------------------------------------------------------------
  // 6. Invalid email format
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when email format is invalid", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ body: JSON.stringify({ email: "not-an-email", password: PASSWORD }), supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "email")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Invalid credentials (authError from Supabase)
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when Supabase returns an auth error", async () => {
    const supabase = buildSupabaseMock({
      authResult: { data: { user: null, session: null }, error: { message: "Invalid login credentials" } },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Invalid email or password");
  });

  // -------------------------------------------------------------------------
  // 8. No user in response without explicit authError
  // -------------------------------------------------------------------------

  it("returns 401 UNAUTHORIZED when user is null even without an authError", async () => {
    const supabase = buildSupabaseMock({
      authResult: { data: { user: null, session: null }, error: null },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  // -------------------------------------------------------------------------
  // 9. Account pending
  // -------------------------------------------------------------------------

  it("returns 403 ACCOUNT_PENDING when profile status is pending", async () => {
    const supabase = buildSupabaseMock({
      profileResult: { data: { id: USER_ID, status: "pending", role: "shelter" }, error: null },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("ACCOUNT_PENDING");
    // Ensure session tokens are NOT returned for pending accounts
    expect(JSON.stringify(body)).not.toContain("access_token");
    // signOut must be called to invalidate the created session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase.auth as any).signOut).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // 10. Account suspended
  // -------------------------------------------------------------------------

  it("returns 403 ACCOUNT_SUSPENDED when profile status is suspended", async () => {
    const supabase = buildSupabaseMock({
      profileResult: { data: { id: USER_ID, status: "suspended", role: "shelter" }, error: null },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("ACCOUNT_SUSPENDED");
    // Ensure session tokens are NOT returned for suspended accounts
    expect(JSON.stringify(body)).not.toContain("access_token");
    // signOut must be called to invalidate the created session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((supabase.auth as any).signOut).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // 11. Profile not found after successful auth
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR when profile is not found after auth", async () => {
    const supabase = buildSupabaseMock({
      profileResult: { data: null, error: null },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    // Internal details must not leak through
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 12. Database error when fetching profile
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR when database error occurs while fetching profile", async () => {
    const supabase = buildSupabaseMock({
      profileResult: { data: null, error: { message: "connection refused" } },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 13. Unexpected error thrown by service
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR on unexpected service error", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: PROFILE, error: null }) }),
        }),
      }),
      auth: {
        signInWithPassword: vi.fn().mockRejectedValue(new Error("Unexpected network error")),
      },
    } as unknown as import("@/db/supabase.client").SupabaseClient;

    const ctx = buildContext({ supabase });
    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  // -------------------------------------------------------------------------
  // 14. Successful login — response validation
  // -------------------------------------------------------------------------

  it("returns 200 OK with user and profile data on successful login", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body = await response.json();

    expect(body.user.id).toBe(USER_ID);
    expect(body.user.email).toBe(USER_EMAIL);
    expect(body.profile.id).toBe(USER_ID);
    expect(body.profile.status).toBe("verified");
    expect(body.profile.role).toBe("shelter");
    // Session tokens must NOT appear in the JSON body — they are set as HttpOnly cookies.
    expect(JSON.stringify(body)).not.toContain("access_token");
    expect(JSON.stringify(body)).not.toContain("refresh_token");
  });

  it("sets HttpOnly sb-access-token and sb-refresh-token cookies on successful login", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(200);
    // Headers.getSetCookie() returns each Set-Cookie entry as a separate string.
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`sb-access-token=${SESSION.access_token}`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`sb-refresh-token=${SESSION.refresh_token}`))).toBe(true);
    // All auth cookies must be HttpOnly to block XSS token theft.
    expect(cookies.every((c) => c.toLowerCase().includes("httponly"))).toBe(true);
  });

  it("does not include password in the response body", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);
    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain(PASSWORD);
  });
});
