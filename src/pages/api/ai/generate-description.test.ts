import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, InternalError, NotFoundError } from "@/lib/errors";

interface LoadRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  rateAllowed?: boolean;
  serviceResult?: { description: string; ai_usage_incremented: boolean };
  serviceError?: Error;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";

async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: USER_ID },
    authError = null,
    rateAllowed = true,
    serviceResult = { description: "Opis wygenerowany przez AI.", ai_usage_incremented: true },
    serviceError,
  } = options;

  const check = vi.fn().mockReturnValue({
    allowed: rateAllowed,
    remaining: rateAllowed ? 9 : 0,
    resetAt: Date.now() + 60_000,
  });

  const generateNeedDescription = serviceError
    ? vi.fn().mockRejectedValue(serviceError)
    : vi.fn().mockResolvedValue(serviceResult);

  vi.doMock("@/lib/rate-limiter", () => ({
    RateLimiter: class {
      check = check;
    },
  }));

  vi.doMock("@/lib/services/ai.service", () => ({
    AIService: class {
      generateNeedDescription = generateNeedDescription;
    },
  }));

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },
  };

  const route = await import("./generate-description");

  return {
    POST: route.POST,
    mocks: {
      check,
      generateNeedDescription,
      getUser: supabase.auth.getUser,
    },
    locals: {
      supabase,
    },
  };
}

describe("POST /api/ai/generate-description", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { POST, locals } = await loadRoute({ authUser: null, authError: { message: "unauthorized" } });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: JSON.stringify({ need_id: "00000000-0000-0000-0000-000000000099" }),
      }),
      locals,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { POST, locals, mocks } = await loadRoute({ rateAllowed: false });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: JSON.stringify({ need_id: "00000000-0000-0000-0000-000000000099" }),
      }),
      locals,
    } as never);

    expect(mocks.check).toHaveBeenCalledWith(USER_ID);
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMIT_EXCEEDED" },
    });
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: "{invalid-json",
        headers: { "Content-Type": "application/json" },
      }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("returns 404 when service throws NotFoundError", async () => {
    const { POST, locals } = await loadRoute({ serviceError: new NotFoundError("Need not found") });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: JSON.stringify({
          need_id: "00000000-0000-0000-0000-000000000099",
          category: "food",
          title: "Karma",
          target_quantity: 5,
          unit: "kg",
        }),
      }),
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns 403 when service throws ForbiddenError", async () => {
    const { POST, locals } = await loadRoute({ serviceError: new ForbiddenError("Forbidden") });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: JSON.stringify({
          need_id: "00000000-0000-0000-0000-000000000099",
          category: "food",
          title: "Karma",
          target_quantity: 5,
          unit: "kg",
        }),
      }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns 500 when service throws InternalError", async () => {
    const { POST, locals } = await loadRoute({ serviceError: new InternalError("Internal") });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: JSON.stringify({
          need_id: "00000000-0000-0000-0000-000000000099",
          category: "food",
          title: "Karma",
          target_quantity: 5,
          unit: "kg",
        }),
      }),
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("returns 200 with generated description on success", async () => {
    const { POST, locals, mocks } = await loadRoute({
      serviceResult: {
        description: "Pilnie potrzebujemy karmy, każda pomoc jest ważna.",
        ai_usage_incremented: true,
      },
    });

    const payload = {
      need_id: "00000000-0000-0000-0000-000000000099",
      category: "food",
      title: "Karma",
      target_quantity: 5,
      unit: "kg",
    };

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-description", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      locals,
    } as never);

    expect(response.status).toBe(200);
    expect(mocks.generateNeedDescription).toHaveBeenCalledWith(payload, USER_ID);
    await expect(response.json()).resolves.toEqual({
      description: "Pilnie potrzebujemy karmy, każda pomoc jest ważna.",
      ai_usage_incremented: true,
    });
  });
});
