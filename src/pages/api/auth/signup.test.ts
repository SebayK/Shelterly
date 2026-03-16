import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./signup";
import type { SignupResponseDTO } from "@/types";

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const USER_ID = "00000000-0000-0000-0000-000000000001";
const USER_EMAIL = "shelter@example.com";
const PASSWORD = "SecureP@ssw0rd";

const PROFILE_INPUT = {
  name: "Schronisko dla Zwierząt",
  nip: "1234567890",
  city: "Warszawa",
  address: "ul. Przykładowa 123",
};

const PROFILE_RESPONSE = {
  id: USER_ID,
  status: "pending" as const,
  name: PROFILE_INPUT.name,
};

const VALID_BODY = {
  email: USER_EMAIL,
  password: PASSWORD,
  profile: PROFILE_INPUT,
};

/**
 * Creates a minimal Astro context for signup tests.
 */
function buildContext({ body = JSON.stringify(VALID_BODY), supabase }: { body?: string | null; supabase?: unknown }) {
  const request = new Request("http://localhost/api/auth/signup", {
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
 * Builds a Supabase mock for signup:
 * - auth.signUp
 * - from("profiles").select(...).eq(...).single()
 */
function buildSupabaseMock({
  authResult = {
    data: { user: { id: USER_ID, email: USER_EMAIL } },
    error: null,
  },
  selectResult = { data: PROFILE_RESPONSE, error: null },
}: {
  authResult?: {
    data: { user: { id: string; email: string } | null };
    error: { message: string; code?: string } | null;
  };
  selectResult?: {
    data: { id: string; status: "pending" | "verified" | "suspended" | "rejected"; name: string | null } | null;
    error: { message: string; code?: string } | null;
  };
} = {}) {
  const single = vi.fn().mockResolvedValue(selectResult);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const signUp = vi.fn().mockResolvedValue(authResult);

  return {
    from,
    auth: { signUp },
  } as unknown as import("@/db/supabase.client").SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/signup", () => {
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
    const request = new Request("http://localhost/api/auth/signup", {
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
    const ctx = buildContext({
      body: JSON.stringify({ password: PASSWORD, profile: PROFILE_INPUT }),
      supabase,
    });

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
    const ctx = buildContext({
      body: JSON.stringify({ email: USER_EMAIL, profile: PROFILE_INPUT }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "password")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Missing profile object
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when profile is missing", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({ email: USER_EMAIL, password: PASSWORD }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field.startsWith("profile"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Missing required profile fields (name missing)
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when required profile field name is missing", async () => {
    const supabase = buildSupabaseMock();
    const { name: _name, ...profileWithoutName } = PROFILE_INPUT;
    const ctx = buildContext({
      body: JSON.stringify({ email: USER_EMAIL, password: PASSWORD, profile: profileWithoutName }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "profile.name")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Invalid email format
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when email format is invalid", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({ email: "not-an-email", password: PASSWORD, profile: PROFILE_INPUT }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "email")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Password too short
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when password is too short", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({ email: USER_EMAIL, password: "Ab1!", profile: PROFILE_INPUT }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "password")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 9. Password missing uppercase letter
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when password has no uppercase letter", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({ email: USER_EMAIL, password: "lowercase1!", profile: PROFILE_INPUT }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(
      body.error.details.some(
        (d: { field: string; message: string }) => d.field === "password" && d.message.includes("uppercase")
      )
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 10. Invalid NIP format
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when NIP is not 10 digits", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({
        email: USER_EMAIL,
        password: PASSWORD,
        profile: { ...PROFILE_INPUT, nip: "12345" },
      }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "profile.nip")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 11. Invalid phone_number format
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when phone_number format is invalid", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({
        email: USER_EMAIL,
        password: PASSWORD,
        profile: { ...PROFILE_INPUT, phone_number: "abc" },
      }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "profile.phone_number")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 12. Invalid website_url format
  // -------------------------------------------------------------------------

  it("returns 400 VALIDATION_ERROR when website_url is not a valid URL", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({
        email: USER_EMAIL,
        password: PASSWORD,
        profile: { ...PROFILE_INPUT, website_url: "not-a-url" },
      }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d: { field: string }) => d.field === "profile.website_url")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 13. Email already registered (Supabase Auth conflict)
  // -------------------------------------------------------------------------

  it("returns 409 CONFLICT when email is already registered", async () => {
    const supabase = buildSupabaseMock({
      authResult: {
        data: { user: null },
        error: { message: "User already registered" },
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("An account with this email or NIP already exists");
  });

  // -------------------------------------------------------------------------
  // 14. NIP already exists (unique constraint 23505)
  // -------------------------------------------------------------------------

  it("returns 409 CONFLICT when NIP already exists even if Supabase returns a generic DB message", async () => {
    const supabase = buildSupabaseMock({
      authResult: {
        data: { user: null },
        error: { message: "Database error saving new user", code: "23505" },
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("An account with this email or NIP already exists");
  });

  // -------------------------------------------------------------------------
  // 15. Supabase Auth error (not a duplicate)
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR on unexpected Supabase Auth error", async () => {
    const supabase = buildSupabaseMock({
      authResult: {
        data: { user: null },
        error: { message: "Service unavailable" },
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 16. Profile INSERT error (not a unique violation)
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR on unexpected profile SELECT error", async () => {
    const supabase = buildSupabaseMock({
      selectResult: {
        data: null,
        error: { message: "connection refused", code: "08006" },
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An internal error occurred");
  });

  // -------------------------------------------------------------------------
  // 17. No user returned from auth.signUp
  // -------------------------------------------------------------------------

  it("returns 500 INTERNAL_ERROR when auth.signUp returns no user", async () => {
    const supabase = buildSupabaseMock({
      authResult: {
        data: { user: null },
        error: null,
      },
    });
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  // -------------------------------------------------------------------------
  // 18. Successful registration — full SignupResponseDTO validation
  // -------------------------------------------------------------------------

  it("returns 201 Created with correct SignupResponseDTO on successful registration", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body: SignupResponseDTO = await response.json();

    expect(body.message).toBe("Registration successful. Please wait for verification.");
    expect(body.user.id).toBe(USER_ID);
    expect(body.user.email).toBe(USER_EMAIL);
    expect(body.profile.id).toBe(USER_ID);
    expect(body.profile.status).toBe("pending");
    expect(body.profile.name).toBe(PROFILE_INPUT.name);
  });

  // -------------------------------------------------------------------------
  // 19. Successful registration without optional fields
  // -------------------------------------------------------------------------

  it("returns 201 Created when optional fields phone_number and website_url are omitted", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({
      body: JSON.stringify({ email: USER_EMAIL, password: PASSWORD, profile: PROFILE_INPUT }),
      supabase,
    });

    const response = await POST(ctx);

    expect(response.status).toBe(201);
    const body: SignupResponseDTO = await response.json();
    expect(body.user.id).toBe(USER_ID);
    expect(body.profile.status).toBe("pending");
  });

  // -------------------------------------------------------------------------
  // 20. Password must not appear in the response
  // -------------------------------------------------------------------------

  it("does not include password in the response body", async () => {
    const supabase = buildSupabaseMock();
    const ctx = buildContext({ supabase });

    const response = await POST(ctx);
    const body = await response.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain(PASSWORD);
  });
});
