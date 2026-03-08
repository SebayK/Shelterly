import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { ProfileService } from "./profile.service";
import type { SupabaseClient } from "@/db/supabase.client";

const USER_ID = "00000000-0000-0000-0000-000000000101";

function buildSupabaseMock({
  profile = {
    id: USER_ID,
    role: "shelter",
    status: "rejected",
    rejection_reason: "Brak podpisanego dokumentu weryfikacyjnego.",
    name: "Azyl Testowy",
    nip: "1234567890",
    city: "Warszawa",
    address: "ul. Testowa 1",
    location: null,
    phone_number: "+48123123123",
    website_url: "https://example.org",
    verification_doc_path: null,
    ai_usage_count: 0,
    created_at: "2026-03-07T10:00:00Z",
    updated_at: "2026-03-07T11:00:00Z",
  } as Record<string, unknown> | null,
  error = null as { message: string } | null,
} = {}) {
  const single = vi.fn().mockResolvedValue({ data: profile, error });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from } as unknown as SupabaseClient;
}

describe("ProfileService.getAuthenticatedProfile()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rejection_reason in ProfileMeDTO for rejected shelters", async () => {
    const service = new ProfileService(buildSupabaseMock());

    const result = await service.getAuthenticatedProfile(USER_ID);

    expect(result.status).toBe("rejected");
    expect(result.rejection_reason).toBe("Brak podpisanego dokumentu weryfikacyjnego.");
  });

  it("returns null rejection_reason when the profile has no rejection reason", async () => {
    const service = new ProfileService(
      buildSupabaseMock({
        profile: {
          id: USER_ID,
          role: "shelter",
          status: "pending",
          rejection_reason: null,
          name: "Azyl Testowy",
          nip: "1234567890",
          city: "Warszawa",
          address: "ul. Testowa 1",
          location: null,
          phone_number: null,
          website_url: null,
          verification_doc_path: null,
          ai_usage_count: 0,
          created_at: "2026-03-07T10:00:00Z",
          updated_at: null,
        },
      })
    );

    const result = await service.getAuthenticatedProfile(USER_ID);

    expect(result.rejection_reason).toBeNull();
  });

  it("throws NotFoundError when the profile does not exist", async () => {
    const service = new ProfileService(buildSupabaseMock({ profile: null }));

    await expect(service.getAuthenticatedProfile(USER_ID)).rejects.toThrow(NotFoundError);
  });
});

describe("ProfileService.uploadVerificationDocument()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a safe file name from the basename and canonical extension", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_746_000_000_000);

    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new ProfileService({
      from,
      storage: {
        from: vi.fn().mockReturnValue({ upload, remove }),
      },
    } as unknown as SupabaseClient);

    const file = new File(["hello"], "zażółć final.exe", { type: "image/png" });

    const result = await service.uploadVerificationDocument(USER_ID, file);

    expect(upload).toHaveBeenCalledWith(
      `verification-docs/${USER_ID}/1746000000000-zazolc-final.png`,
      file,
      expect.objectContaining({ contentType: "image/png", upsert: false })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_doc_path: `verification-docs/${USER_ID}/1746000000000-zazolc-final.png`,
      })
    );
    expect(result.verification_doc_path).toBe(`verification-docs/${USER_ID}/1746000000000-zazolc-final.png`);
  });

  it("rejects unsupported file types even if the route validation is bypassed", async () => {
    const upload = vi.fn();
    const service = new ProfileService({
      from: vi.fn(),
      storage: {
        from: vi.fn().mockReturnValue({ upload }),
      },
    } as unknown as SupabaseClient);

    const file = new File(["hello"], "document.gif", { type: "image/gif" });

    await expect(service.uploadVerificationDocument(USER_ID, file)).rejects.toThrow(ValidationError);
    expect(upload).not.toHaveBeenCalled();
  });
});
