import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, InternalError, NotFoundError } from "@/lib/errors";

interface LoadRouteOptions {
  authUser?: { id: string } | null;
  authError?: { message: string } | null;
  rateAllowed?: boolean;
  serviceResult?: { shopping_url: string; ai_usage_incremented: boolean };
  serviceErrorClass?: "NotFoundError" | "ForbiddenError" | "InternalError";
  serviceErrorMessage?: string;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";

async function loadRoute(options: LoadRouteOptions = {}) {
  const {
    authUser = { id: USER_ID },
    authError = null,
    rateAllowed = true,
    serviceResult = {
      shopping_url: "https://www.ceneo.pl/search?q=karma+mokra+koty",
      ai_usage_incremented: true,
    },
    serviceErrorClass,
    serviceErrorMessage,
  } = options;

  const check = vi.fn().mockReturnValue({
    allowed: rateAllowed,
    remaining: rateAllowed ? 9 : 0,
    resetAt: Date.now() + 60_000,
  });

  let generateShoppingLink: ReturnType<typeof vi.fn>;
  if (serviceErrorClass) {
    const errors = await import("@/lib/errors");
    const msg = serviceErrorMessage ?? "service error";
    let err: Error;
    if (serviceErrorClass === "NotFoundError") err = new errors.NotFoundError(msg);
    else if (serviceErrorClass === "ForbiddenError") err = new errors.ForbiddenError(msg);
    else err = new errors.InternalError(msg);
    generateShoppingLink = vi.fn().mockRejectedValue(err);
  } else {
    generateShoppingLink = vi.fn().mockResolvedValue(serviceResult);
  }

  vi.doMock("@/lib/rate-limiter", () => ({
    RateLimiter: class {
      check = check;
    },
  }));

  vi.doMock("@/lib/services/ai.service", () => ({
    AIService: class {
      generateShoppingLink = generateShoppingLink;
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

  const route = await import("./generate-shopping-link");

  return {
    POST: route.POST,
    mocks: {
      check,
      generateShoppingLink,
      getUser: supabase.auth.getUser,
    },
    locals: {
      supabase,
    },
  };
}

const VALID_PAYLOAD = {
  need_id: "00000000-0000-0000-0000-000000000099",
  title: "Karma mokra dla kotów",
  category: "food",
};

describe("POST /api/ai/generate-shopping-link", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const { POST, locals } = await loadRoute({ authUser: null, authError: { message: "unauthorized" } });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify({ need_id: VALID_PAYLOAD.need_id }),
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
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify({ need_id: VALID_PAYLOAD.need_id }),
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
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
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

  it("returns 400 when need_id is not a valid UUID", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify({ need_id: "not-a-uuid", title: "Karma", category: "food" }),
      }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("returns 400 when category is invalid", async () => {
    const { POST, locals } = await loadRoute();

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify({ need_id: VALID_PAYLOAD.need_id, title: "Karma", category: "invalid_category" }),
      }),
      locals,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("returns 404 when service throws NotFoundError", async () => {
    const { POST, locals } = await loadRoute({
      serviceErrorClass: "NotFoundError",
      serviceErrorMessage: "Need not found",
    });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      }),
      locals,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns 403 when service throws ForbiddenError (not owner)", async () => {
    const { POST, locals } = await loadRoute({
      serviceErrorClass: "ForbiddenError",
      serviceErrorMessage: "You are not the owner of this need",
    });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns 403 when service throws ForbiddenError (AI limit exceeded)", async () => {
    const { POST, locals } = await loadRoute({
      serviceErrorClass: "ForbiddenError",
      serviceErrorMessage: "AI usage limit exceeded",
    });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      }),
      locals,
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns 500 when service throws InternalError", async () => {
    const { POST, locals } = await loadRoute({ serviceErrorClass: "InternalError", serviceErrorMessage: "Internal" });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      }),
      locals,
    } as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("returns 200 with shopping_url on success", async () => {
    const serviceResult = {
      shopping_url: "https://www.ceneo.pl/search?q=karma+mokra+koty",
      ai_usage_incremented: true,
    };

    const { POST, locals, mocks } = await loadRoute({ serviceResult });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      }),
      locals,
    } as never);

    expect(response.status).toBe(200);
    expect(mocks.generateShoppingLink).toHaveBeenCalledWith(VALID_PAYLOAD, USER_ID);
    await expect(response.json()).resolves.toEqual(serviceResult);
  });

  it("returns 200 with ai_usage_incremented=false when increment fails", async () => {
    const serviceResult = {
      shopping_url: "https://www.ceneo.pl/search?q=karma+mokra+koty",
      ai_usage_incremented: false,
    };

    const { POST, locals } = await loadRoute({ serviceResult });

    const response = await POST({
      request: new Request("http://localhost/api/ai/generate-shopping-link", {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      }),
      locals,
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      shopping_url: "https://www.ceneo.pl/search?q=karma+mokra+koty",
      ai_usage_incremented: false,
    });
  });
});
