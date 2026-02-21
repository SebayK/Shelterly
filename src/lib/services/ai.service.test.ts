import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIService } from "./ai.service";
import { ForbiddenError, InternalError, NotFoundError } from "@/lib/errors";
import type { GenerateDescriptionCommand } from "@/types";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";
const NEED_ID = "00000000-0000-0000-0000-000000000099";

const COMMAND: GenerateDescriptionCommand = {
  need_id: NEED_ID,
  category: "food",
  title: "Karma mokra dla kotów",
  target_quantity: 50,
  unit: "kg",
};

interface BuildSupabaseMockOptions {
  needData?: { id: string; shelter_id: string } | null;
  needError?: { message: string; code?: string } | null;
  profileData?: { ai_usage_count: number } | null;
  profileError?: { message: string; code?: string } | null;
  updateNeedError?: { message: string; code?: string } | null;
  incrementError?: { message: string; code?: string } | null;
}

function buildSupabaseMock(options: BuildSupabaseMockOptions = {}) {
  const {
    needData = { id: NEED_ID, shelter_id: USER_ID },
    needError = null,
    profileData = { ai_usage_count: 0 },
    profileError = null,
    updateNeedError = null,
    incrementError = null,
  } = options;

  const maybeSingleNeeds = vi.fn().mockResolvedValue({ data: needData, error: needError });
  const maybeSingleProfiles = vi.fn().mockResolvedValue({ data: profileData, error: profileError });

  const needsSelectChain = {
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        maybeSingle: maybeSingleNeeds,
      }),
    }),
  };

  const profilesSelectChain = {
    eq: vi.fn().mockReturnValue({
      maybeSingle: maybeSingleProfiles,
    }),
  };

  const needsUpdateResult = {
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ error: updateNeedError }),
    }),
  };

  const profilesUpdateResult = {
    eq: vi.fn().mockResolvedValue({ error: incrementError }),
  };

  const from = vi.fn((table: string) => {
    if (table === "needs") {
      return {
        select: vi.fn().mockReturnValue(needsSelectChain),
        update: vi.fn().mockReturnValue(needsUpdateResult),
      };
    }

    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue(profilesSelectChain),
        update: vi.fn().mockReturnValue(profilesUpdateResult),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as import("@/db/supabase.client").SupabaseClient;
}

describe("AIService.generateNeedDescription()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns generated description and ai_usage_incremented=true on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Pilnie potrzebujemy karmy dla kotów. Każda pomoc ma znaczenie." } }],
        }),
        { status: 200 }
      )
    );

    const service = new AIService(buildSupabaseMock());
    const result = await service.generateNeedDescription(COMMAND, USER_ID);

    expect(result).toEqual({
      description: "Pilnie potrzebujemy karmy dla kotów. Każda pomoc ma znaczenie.",
      ai_usage_incremented: true,
    });
  });

  it("throws NotFoundError when need does not exist", async () => {
    const service = new AIService(buildSupabaseMock({ needData: null }));

    await expect(service.generateNeedDescription(COMMAND, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when user is not owner of need", async () => {
    const service = new AIService(buildSupabaseMock({ needData: { id: NEED_ID, shelter_id: OTHER_USER_ID } }));

    await expect(service.generateNeedDescription(COMMAND, USER_ID)).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when AI usage limit is exceeded", async () => {
    const service = new AIService(buildSupabaseMock({ profileData: { ai_usage_count: 100 } }));

    await expect(service.generateNeedDescription(COMMAND, USER_ID)).rejects.toThrow(ForbiddenError);
  });

  it("throws InternalError when OpenRouter returns non-2xx status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "upstream" }), { status: 500 }));

    const service = new AIService(buildSupabaseMock());

    await expect(service.generateNeedDescription(COMMAND, USER_ID)).rejects.toThrow(InternalError);
  });

  it("returns ai_usage_incremented=false when description save succeeds but increment fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Brakuje karmy, prosimy o wsparcie." } }],
        }),
        { status: 200 }
      )
    );

    const service = new AIService(
      buildSupabaseMock({
        incrementError: { message: "increment failed", code: "23514" },
      })
    );

    const result = await service.generateNeedDescription(COMMAND, USER_ID);

    expect(result).toEqual({
      description: "Brakuje karmy, prosimy o wsparcie.",
      ai_usage_incremented: false,
    });
  });
});
