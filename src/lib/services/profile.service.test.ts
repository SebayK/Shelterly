import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileService } from "./profile.service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { SupabaseClient } from "@/db/supabase.client";

describe("ProfileService.parseEwkbPoint", () => {
  it("parses EWKB hex for POINT with SRID 4326 (little endian)", () => {
    // Build EWKB for little-endian POINT with SRID 4326
    // Layout: 1 byte byte-order, 4 bytes geom type, optional 4 bytes SRID, then two doubles (lon, lat)
    const buffer = Buffer.alloc(1 + 4 + 4 + 8 + 8);
    let offset = 0;
    // little-endian
    buffer.writeUInt8(1, offset);
    offset += 1;
    // geometry type: POINT (1) with SRID flag (0x20000000)
    buffer.writeUInt32LE(0x20000000 | 1, offset);
    offset += 4;
    // SRID 4326
    buffer.writeUInt32LE(4326, offset);
    offset += 4;

    const lon = 21.0122;
    const lat = 52.2297;

    buffer.writeDoubleLE(lon, offset);
    offset += 8;
    buffer.writeDoubleLE(lat, offset);
    offset += 8;

    const hex = buffer.toString("hex");

    const svc = new ProfileService({} as any);
    const result = (svc as any).parseEwkbPoint(hex);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(lat, 6);
    expect(result!.lon).toBeCloseTo(lon, 6);
  });

  it("parses EWKB hex for POINT without SRID (big endian)", () => {
    // Build EWKB for big-endian POINT without SRID
    // Layout: 1 byte byte-order (0) + 4 bytes geom type (1) + two doubles (lon, lat)
    const buffer = Buffer.alloc(1 + 4 + 8 + 8);
    let offset = 0;
    // big-endian
    buffer.writeUInt8(0, offset);
    offset += 1;
    // geometry type: POINT (1) without SRID flag
    buffer.writeUInt32BE(1, offset);
    offset += 4;

    const lon = 18.9496;
    const lat = 50.1372;

    buffer.writeDoubleBE(lon, offset);
    offset += 8;
    buffer.writeDoubleBE(lat, offset);
    offset += 8;

    const hex = buffer.toString("hex");

    const svc = new ProfileService({} as any);
    const result = (svc as any).parseEwkbPoint(hex);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(lat, 6);
    expect(result!.lon).toBeCloseTo(lon, 6);
  });
});

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

function buildProfilesListSupabaseMock({
  profiles,
  error = null as { message: string } | null,
}: {
  profiles: Record<string, unknown>[] | null;
  error?: { message: string } | null;
}) {
  const query = {
    data: profiles,
    error,
    eq: vi.fn(),
    filter: vi.fn(),
  };

  query.eq.mockReturnValue(query);
  query.filter.mockReturnValue(query);

  const select = vi.fn().mockReturnValue(query);
  const from = vi.fn().mockReturnValue({ select });

  return { from } as unknown as SupabaseClient;
}

function buildProfileDetailSupabaseMock({
  profile,
  profileError = null as { message: string } | null,
  needs = [] as { urgency: string; is_fulfilled: boolean }[],
  needsError = null as { message: string } | null,
}) {
  const single = vi.fn().mockResolvedValue({ data: profile, error: profileError });
  const profileQuery = {
    eq: vi.fn(),
    single,
  };
  profileQuery.eq.mockReturnValue(profileQuery);

  const is = vi.fn().mockResolvedValue({ data: needs, error: needsError });
  const needsQuery = {
    eq: vi.fn().mockReturnValue({ is }),
  };

  const select = vi.fn().mockReturnValueOnce(profileQuery).mockReturnValueOnce(needsQuery);

  const from = vi.fn().mockReturnValue({ select });

  return { from } as unknown as SupabaseClient;
}

function buildProfileUpdateSupabaseMock({
  profile,
  error = null as { message: string } | null,
}: {
  profile: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({ data: profile, error });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });

  return {
    client: { from } as unknown as SupabaseClient,
    update,
  };
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

describe("ProfileService.getVerifiedProfiles()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out verified shelters without a valid location and reports the filtered total", async () => {
    const service = new ProfileService(
      buildProfilesListSupabaseMock({
        profiles: [
          {
            id: "valid-profile",
            name: "Schronisko Północ",
            city: "Gdańsk",
            location: "POINT(18.6466 54.3520)",
            created_at: "2026-03-07T10:00:00Z",
            needs: [{ urgency: "critical", is_fulfilled: false }],
          },
          {
            id: "invalid-profile",
            name: "Schronisko Bez Lokalizacji",
            city: "Warszawa",
            location: null,
            created_at: "2026-03-07T10:00:00Z",
            needs: [],
          },
        ],
      })
    );

    const result = await service.getVerifiedProfiles({ limit: 20, offset: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "valid-profile",
      city: "Gdańsk",
      location: { lat: 54.352, lon: 18.6466 },
      has_urgent_needs: true,
    });
    expect(result.pagination.total).toBe(1);
  });

  it("parses EWKB hex locations returned by Supabase REST", async () => {
    const service = new ProfileService(
      buildProfilesListSupabaseMock({
        profiles: [
          {
            id: "ewkb-profile",
            name: "Schronisko Geo",
            city: "Tychy",
            location: "0101000020E6100000174850FC18F332406F8104C58F114940",
            created_at: "2026-03-07T10:00:00Z",
            needs: [{ urgency: "high", is_fulfilled: false }],
          },
        ],
      })
    );

    const result = await service.getVerifiedProfiles({ limit: 20, offset: 0 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "ewkb-profile",
      location: { lat: 50.1372, lon: 18.9496 },
      urgent_needs_count: 1,
    });
  });

  it("calculates distances only for shelters that pass DTO validation", async () => {
    const service = new ProfileService(
      buildProfilesListSupabaseMock({
        profiles: [
          {
            id: "nearest-profile",
            name: "Schronisko Centrum",
            city: "Warszawa",
            location: "POINT(21.0122 52.2297)",
            created_at: "2026-03-07T10:00:00Z",
            needs: [],
          },
          {
            id: "skipped-profile",
            name: "Schronisko Brak Geo",
            city: "Łódź",
            location: null,
            created_at: "2026-03-07T10:00:00Z",
            needs: [],
          },
        ],
      })
    );

    const result = await service.getVerifiedProfiles({
      lat: 52.2297,
      lon: 21.0122,
      limit: 20,
      offset: 0,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("nearest-profile");
    expect(result.data[0]?.distance_km).toBe(0);
    expect(result.pagination.total).toBe(1);
  });
});

describe("ProfileService.getProfileById()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NotFoundError when a verified shelter has no valid location", async () => {
    const service = new ProfileService(
      buildProfileDetailSupabaseMock({
        profile: {
          id: USER_ID,
          role: "shelter",
          status: "verified",
          name: "Azyl Testowy",
          city: "Warszawa",
          address: "ul. Testowa 1",
          location: null,
          phone_number: null,
          website_url: null,
          created_at: "2026-03-07T10:00:00Z",
        },
      })
    );

    await expect(service.getProfileById(USER_ID)).rejects.toThrow(NotFoundError);
  });

  it("returns profile detail when location comes back as EWKB hex", async () => {
    const service = new ProfileService(
      buildProfileDetailSupabaseMock({
        profile: {
          id: USER_ID,
          role: "shelter",
          status: "verified",
          name: "Azyl Testowy",
          city: "Warszawa",
          address: "ul. Testowa 1",
          location: "0101000020E6100000174850FC18F332406F8104C58F114940",
          phone_number: null,
          website_url: null,
          created_at: "2026-03-07T10:00:00Z",
        },
        needs: [{ urgency: "high", is_fulfilled: false }],
      })
    );

    const result = await service.getProfileById(USER_ID);

    expect(result.location).toEqual({ lat: 50.1372, lon: 18.9496 });
    expect(result.needs_summary).toEqual({ total: 1, urgent: 1, fulfilled: 0 });
  });
});

describe("ProfileService.updateProfile()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists location as a PostGIS point and returns parsed coordinates", async () => {
    const { client, update } = buildProfileUpdateSupabaseMock({
      profile: {
        id: USER_ID,
        name: "Azyl Testowy",
        city: "Gdańsk",
        location: "POINT(18.6481226 54.3495195)",
        updated_at: "2026-03-09T10:00:00Z",
      },
    });

    const service = new ProfileService(client);

    const result = await service.updateProfile(USER_ID, {
      city: "Gdańsk",
      address: "ul. Długa 1",
      location: { lat: 54.3495195, lon: 18.6481226 },
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "Gdańsk",
        address: "ul. Długa 1",
        location: "POINT(18.6481226 54.3495195)",
      })
    );
    expect(result.location).toEqual({ lat: 54.3495195, lon: 18.6481226 });
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
