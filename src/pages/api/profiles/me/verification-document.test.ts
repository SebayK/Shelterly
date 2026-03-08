import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "00000000-0000-0000-0000-000000000101";

async function loadRouteWithServiceError() {
  const { ValidationError } = await import("@/lib/errors");
  const uploadVerificationDocument = vi
    .fn()
    .mockRejectedValue(new ValidationError("File must be PDF, JPEG, or PNG"));

  vi.doMock("../../../../lib/services/profile.service", () => ({
    ProfileService: class {
      uploadVerificationDocument = uploadVerificationDocument;
    },
  }));

  const route = await import("./verification-document");

  return {
    POST: route.POST,
    uploadVerificationDocument,
  };
}

function makeRequest(file: File): Request {
  const formData = new FormData();
  formData.set("file", file);

  return new Request("http://localhost/api/profiles/me/verification-document", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/profiles/me/verification-document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 when ProfileService rejects the upload as invalid", async () => {
    const { POST, uploadVerificationDocument } = await loadRouteWithServiceError();
    const response = await POST({
      request: makeRequest(new File(["hello"], "document.pdf", { type: "application/pdf" })),
      locals: {
        supabase: {
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
          },
        },
      },
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "File must be PDF, JPEG, or PNG",
        details: undefined,
      },
    });
    expect(uploadVerificationDocument).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: "document.pdf", type: "application/pdf" })
    );
  });
});