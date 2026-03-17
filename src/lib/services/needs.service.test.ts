import { describe, it, expect, vi, beforeEach } from "vitest";
import { NeedsService } from "./needs.service";
import { InternalError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import type { CreateNeedCommand, UpdateNeedCommand } from "@/types";

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Supabase client mock that returns the provided values
 * when `.from("needs").insert(...).select(...).single()` is called.
 */
function buildSupabaseMock({
  data = null,
  error = null,
}: {
  data?: Record<string, unknown> | null;
  error?: { message: string; code?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });

  return { from } as unknown as import("@/db/supabase.client").SupabaseClient;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SHELTER_ID = "00000000-0000-0000-0000-000000000001";

const COMMAND: CreateNeedCommand = {
  category: "food",
  title: "Karma sucha dla psów",
  urgency: "normal",
  target_quantity: 100,
  unit: "kg",
};

const DB_ROW = {
  id: "00000000-0000-0000-0000-000000000099",
  shelter_id: SHELTER_ID,
  category: "food",
  title: "Karma sucha dla psów",
  description: null,
  shopping_url: null,
  urgency: "normal",
  target_quantity: 100,
  current_quantity: 0,
  unit: "kg",
  is_fulfilled: false,
  created_at: "2026-01-21T10:30:00Z",
};

function buildPublicNeedsRpcMock({
  rows = [] as Record<string, unknown>[],
  error = null as { message: string; code?: string } | null,
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: rows, error });

  return { rpc } as unknown as import("@/db/supabase.client").SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NeedsService.getNeeds()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps public needs rpc rows to NeedListResponseDTO", async () => {
    const service = new NeedsService(
      buildPublicNeedsRpcMock({
        rows: [
          {
            id: "need-1",
            category: "food",
            title: "Karma mokra",
            description: "Dla kotów",
            urgency: "high",
            target_quantity: 20,
            current_quantity: 5,
            unit: "kg",
            is_fulfilled: false,
            created_at: "2026-03-10T10:00:00Z",
            shelter_id: SHELTER_ID,
            shelter_name: "Azyl Testowy",
            shelter_city: "Warszawa",
            total_count: 3,
          },
        ],
      })
    );

    const result = await service.getNeeds({ limit: 20, offset: 0 });

    expect(result).toEqual({
      data: [
        {
          id: "need-1",
          shelter: {
            id: SHELTER_ID,
            name: "Azyl Testowy",
            city: "Warszawa",
          },
          category: "food",
          title: "Karma mokra",
          description: "Dla kotów",
          urgency: "high",
          target_quantity: 20,
          current_quantity: 5,
          unit: "kg",
          progress_percentage: 25,
          is_fulfilled: false,
          created_at: "2026-03-10T10:00:00Z",
        },
      ],
      pagination: {
        total: 3,
        limit: 20,
        offset: 0,
      },
    });
  });

  it("passes optional filters to get_public_needs rpc", async () => {
    const supabase = buildPublicNeedsRpcMock();
    const service = new NeedsService(supabase);

    await service.getNeeds({
      shelter_id: SHELTER_ID,
      category: "food",
      urgency: "critical",
      fulfilled: false,
      limit: 10,
      offset: 20,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("get_public_needs", {
      p_limit: 10,
      p_offset: 20,
      p_shelter_id: SHELTER_ID,
      p_category: "food",
      p_urgency: "critical",
      p_fulfilled: false,
    });
  });

  it("throws InternalError when the public needs rpc fails", async () => {
    const service = new NeedsService(
      buildPublicNeedsRpcMock({
        error: { message: "permission denied" },
      })
    );

    await expect(service.getNeeds({ limit: 20, offset: 0 })).rejects.toThrow(InternalError);
  });

  it("preserves total count when a paginated rpc page is empty", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: "need-count-only",
            category: "food",
            title: "Karma",
            description: null,
            urgency: "normal",
            target_quantity: 10,
            current_quantity: 0,
            unit: "kg",
            is_fulfilled: false,
            created_at: "2026-03-10T10:00:00Z",
            shelter_id: SHELTER_ID,
            shelter_name: "Azyl Testowy",
            shelter_city: "Warszawa",
            total_count: 5,
          },
        ],
        error: null,
      });

    const service = new NeedsService({ rpc } as unknown as import("@/db/supabase.client").SupabaseClient);

    const result = await service.getNeeds({ limit: 20, offset: 40 });

    expect(result).toEqual({
      data: [],
      pagination: {
        total: 5,
        limit: 20,
        offset: 40,
      },
    });
  });
});

describe("NeedsService.getNeedById()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps public need detail rpc rows to NeedDetailDTO", async () => {
    const service = new NeedsService(
      buildPublicNeedsRpcMock({
        rows: [
          {
            id: "need-1",
            category: "medical",
            title: "Leki",
            description: "Pilnie potrzebne",
            shopping_url: "https://example.org/need",
            urgency: "critical",
            target_quantity: 10,
            current_quantity: 4,
            unit: "pcs",
            is_fulfilled: false,
            created_at: "2026-03-10T10:00:00Z",
            updated_at: "2026-03-10T12:00:00Z",
            shelter_id: SHELTER_ID,
            shelter_name: "Azyl Testowy",
            shelter_city: "Warszawa",
            shelter_phone_number: "+48123123123",
          },
        ],
      })
    );

    const result = await service.getNeedById("need-1");

    expect(result).toEqual({
      id: "need-1",
      shelter: {
        id: SHELTER_ID,
        name: "Azyl Testowy",
        city: "Warszawa",
        phone_number: "+48123123123",
      },
      category: "medical",
      title: "Leki",
      description: "Pilnie potrzebne",
      shopping_url: "https://example.org/need",
      urgency: "critical",
      target_quantity: 10,
      current_quantity: 4,
      unit: "pcs",
      progress_percentage: 40,
      is_fulfilled: false,
      created_at: "2026-03-10T10:00:00Z",
      updated_at: "2026-03-10T12:00:00Z",
    });
  });

  it("throws NotFoundError when the public need detail rpc returns no rows", async () => {
    const service = new NeedsService(buildPublicNeedsRpcMock());

    await expect(service.getNeedById("missing-need")).rejects.toThrow(NotFoundError);
  });

  it("throws InternalError when the public need detail rpc fails", async () => {
    const service = new NeedsService(
      buildPublicNeedsRpcMock({
        error: { message: "db unavailable" },
      })
    );

    await expect(service.getNeedById("need-1")).rejects.toThrow(InternalError);
  });
});

describe("NeedsService.createNeed()", () => {
  let service: NeedsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns NeedCreateResponseDTO on successful insert", async () => {
    service = new NeedsService(buildSupabaseMock({ data: DB_ROW }));

    const result = await service.createNeed(SHELTER_ID, COMMAND);

    expect(result).toEqual({
      id: DB_ROW.id,
      shelter_id: SHELTER_ID,
      category: "food",
      title: "Karma sucha dla psów",
      description: null,
      shopping_url: null,
      urgency: "normal",
      target_quantity: 100,
      current_quantity: 0,
      unit: "kg",
      is_fulfilled: false,
      created_at: DB_ROW.created_at,
    });
  });

  it("passes correct shelter_id and command fields to supabase insert", async () => {
    const supabase = buildSupabaseMock({ data: DB_ROW });
    service = new NeedsService(supabase);

    await service.createNeed(SHELTER_ID, COMMAND);

    // Retrieve the mock for `insert` via the chain
    const insertMock = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shelter_id: SHELTER_ID,
        category: COMMAND.category,
        title: COMMAND.title,
        urgency: COMMAND.urgency,
        target_quantity: COMMAND.target_quantity,
        unit: COMMAND.unit,
      })
    );
  });

  it("maps optional description from command to insert payload", async () => {
    const commandWithDesc: CreateNeedCommand = { ...COMMAND, description: "Dla 20 psów" };
    const rowWithDesc = { ...DB_ROW, description: "Dla 20 psów" };
    const supabase = buildSupabaseMock({ data: rowWithDesc });
    service = new NeedsService(supabase);

    const result = await service.createNeed(SHELTER_ID, commandWithDesc);

    expect(result.description).toBe("Dla 20 psów");
  });

  it("maps optional shopping_url from command to insert payload", async () => {
    const commandWithUrl: CreateNeedCommand = {
      ...COMMAND,
      shopping_url: "https://example.com/karma",
    };
    const rowWithUrl = { ...DB_ROW, shopping_url: "https://example.com/karma" };
    const supabase = buildSupabaseMock({ data: rowWithUrl });
    service = new NeedsService(supabase);

    const result = await service.createNeed(SHELTER_ID, commandWithUrl);

    expect(result.shopping_url).toBe("https://example.com/karma");
  });

  it("returns current_quantity as 0 and is_fulfilled as false (DB defaults)", async () => {
    service = new NeedsService(buildSupabaseMock({ data: DB_ROW }));

    const result = await service.createNeed(SHELTER_ID, COMMAND);

    expect(result.current_quantity).toBe(0);
    expect(result.is_fulfilled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Error path
  // -------------------------------------------------------------------------

  it("throws InternalError when supabase returns an error", async () => {
    service = new NeedsService(buildSupabaseMock({ error: { message: "DB error", code: "23505" } }));

    await expect(service.createNeed(SHELTER_ID, COMMAND)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message", async () => {
    service = new NeedsService(buildSupabaseMock({ error: { message: "connection refused" } }));

    await expect(service.createNeed(SHELTER_ID, COMMAND)).rejects.toThrow("Unable to create need");
  });

  it("does not leak DB error details in the thrown InternalError", async () => {
    service = new NeedsService(buildSupabaseMock({ error: { message: "internal pg error" } }));

    await expect(service.createNeed(SHELTER_ID, COMMAND)).rejects.not.toThrow("internal pg error");
  });
});

// ---------------------------------------------------------------------------
// fulfillNeed tests
// ---------------------------------------------------------------------------

describe("NeedsService.fulfillNeed()", () => {
  const NEED_ID = "00000000-0000-0000-0000-000000000099";
  const USER_ID = "00000000-0000-0000-0000-000000000001";
  const NEED_ROW = {
    id: NEED_ID,
    shelter_id: USER_ID,
    is_fulfilled: false,
  };
  const UPDATED_ROW = {
    id: NEED_ID,
    is_fulfilled: true,
    updated_at: "2026-02-24T10:00:00Z",
  };

  /**
   * Builds a Supabase client mock that handles two sequential `from("needs")` calls:
   *  1. SELECT chain: .select().eq().is().maybeSingle()
   *  2. UPDATE chain: .update().eq().select().single()
   */
  function buildFulfillMock({
    selectData = NEED_ROW as typeof NEED_ROW | null,
    selectError = null as { message: string; code?: string } | null,
    updateData = UPDATED_ROW as typeof UPDATED_ROW | null,
    updateError = null as { message: string; code?: string } | null,
  } = {}) {
    // SELECT chain
    const maybeSingle = vi.fn().mockResolvedValue({ data: selectData, error: selectError });
    const isNull = vi.fn().mockReturnValue({ maybeSingle });
    const eqSelect = vi.fn().mockReturnValue({ is: isNull });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSelect });

    // UPDATE chain
    const single = vi.fn().mockResolvedValue({ data: updateData, error: updateError });
    const selectUpdate = vi.fn().mockReturnValue({ single });
    const eqUpdate = vi.fn().mockReturnValue({ select: selectUpdate });
    const updateFn = vi.fn().mockReturnValue({ eq: eqUpdate });

    const from = vi.fn().mockReturnValueOnce({ select: selectFn }).mockReturnValueOnce({ update: updateFn });

    return { from } as unknown as import("@/db/supabase.client").SupabaseClient;
  }

  let service: NeedsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns NeedFulfillResponseDTO on success", async () => {
    service = new NeedsService(buildFulfillMock());

    const result = await service.fulfillNeed(NEED_ID, USER_ID);

    expect(result).toEqual({
      id: NEED_ID,
      is_fulfilled: true,
      updated_at: UPDATED_ROW.updated_at,
    });
  });

  // -------------------------------------------------------------------------
  // NotFoundError paths
  // -------------------------------------------------------------------------

  it("throws NotFoundError when need does not exist or is soft-deleted", async () => {
    service = new NeedsService(buildFulfillMock({ selectData: null }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError with message "Need not found" when no row returned', async () => {
    service = new NeedsService(buildFulfillMock({ selectData: null }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow("Need not found");
  });

  it("throws NotFoundError when need is already fulfilled", async () => {
    const fulfilledNeed = { ...NEED_ROW, is_fulfilled: true };
    service = new NeedsService(buildFulfillMock({ selectData: fulfilledNeed }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError with "Need is already fulfilled" when already fulfilled', async () => {
    const fulfilledNeed = { ...NEED_ROW, is_fulfilled: true };
    service = new NeedsService(buildFulfillMock({ selectData: fulfilledNeed }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow("Need is already fulfilled");
  });

  // -------------------------------------------------------------------------
  // ForbiddenError path
  // -------------------------------------------------------------------------

  it("throws ForbiddenError when authenticated user is not the owner", async () => {
    const otherOwnerNeed = { ...NEED_ROW, shelter_id: "00000000-0000-0000-0000-000000000002" };
    service = new NeedsService(buildFulfillMock({ selectData: otherOwnerNeed }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow(ForbiddenError);
  });

  // -------------------------------------------------------------------------
  // InternalError paths
  // -------------------------------------------------------------------------

  it("throws InternalError on SELECT database error", async () => {
    service = new NeedsService(buildFulfillMock({ selectError: { message: "connection refused" } }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message on SELECT error", async () => {
    service = new NeedsService(buildFulfillMock({ selectError: { message: "pg error" } }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow("Unable to retrieve need");
  });

  it("throws InternalError on UPDATE database error", async () => {
    service = new NeedsService(buildFulfillMock({ updateError: { message: "constraint violation", code: "23514" } }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message on UPDATE error", async () => {
    service = new NeedsService(buildFulfillMock({ updateError: { message: "pg error" } }));

    await expect(service.fulfillNeed(NEED_ID, USER_ID)).rejects.toThrow("Unable to fulfill need");
  });
});

// ---------------------------------------------------------------------------
// updateNeed tests
// ---------------------------------------------------------------------------

describe("NeedsService.updateNeed()", () => {
  const NEED_ID = "00000000-0000-0000-0000-000000000099";
  const USER_ID = "00000000-0000-0000-0000-000000000001";
  const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";

  const EXISTING_NEED = {
    id: NEED_ID,
    shelter_id: USER_ID,
    target_quantity: 100,
    current_quantity: 10,
  };

  const UPDATED_ROW = {
    id: NEED_ID,
    title: "Updated title",
    description: "Updated description",
    urgency: "high" as const,
    current_quantity: 25,
    target_quantity: 100,
    updated_at: "2026-02-24T11:00:00Z",
  };

  const COMMAND: UpdateNeedCommand = {
    title: "Updated title",
    description: "Updated description",
    urgency: "high",
    current_quantity: 25,
  };

  /**
   * Builds a Supabase client mock that handles two sequential `from("needs")` calls:
   *  1. SELECT chain: .select().eq().is().maybeSingle()
   *  2. UPDATE chain: .update().eq().select().single()
   */
  function buildUpdateMock({
    selectData = EXISTING_NEED as typeof EXISTING_NEED | null,
    selectError = null as { message: string; code?: string } | null,
    updateData = UPDATED_ROW as typeof UPDATED_ROW | null,
    updateError = null as { message: string; code?: string } | null,
  } = {}) {
    // SELECT chain
    const maybeSingle = vi.fn().mockResolvedValue({ data: selectData, error: selectError });
    const isNull = vi.fn().mockReturnValue({ maybeSingle });
    const eqSelect = vi.fn().mockReturnValue({ is: isNull });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSelect });

    // UPDATE chain
    const single = vi.fn().mockResolvedValue({ data: updateData, error: updateError });
    const selectUpdate = vi.fn().mockReturnValue({ single });
    const eqUpdate = vi.fn().mockReturnValue({ select: selectUpdate });
    const updateFn = vi.fn().mockReturnValue({ eq: eqUpdate });

    const from = vi.fn().mockReturnValueOnce({ select: selectFn }).mockReturnValueOnce({ update: updateFn });

    return { from } as unknown as import("@/db/supabase.client").SupabaseClient;
  }

  let service: NeedsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns NeedUpdateResponseDTO on successful update", async () => {
    service = new NeedsService(buildUpdateMock());

    const result = await service.updateNeed(NEED_ID, USER_ID, COMMAND);

    expect(result).toEqual({
      id: NEED_ID,
      title: "Updated title",
      description: "Updated description",
      urgency: "high",
      current_quantity: 25,
      progress_percentage: 25, // 25/100 * 100
      updated_at: UPDATED_ROW.updated_at,
    });
  });

  it("calculates progress_percentage correctly", async () => {
    const updatedRow = { ...UPDATED_ROW, current_quantity: 50, target_quantity: 200 };
    service = new NeedsService(buildUpdateMock({ updateData: updatedRow }));

    const result = await service.updateNeed(NEED_ID, USER_ID, COMMAND);

    expect(result.progress_percentage).toBe(25); // 50/200 * 100
  });

  it("sets progress_percentage to 0 when target_quantity is 0", async () => {
    const updatedRow = { ...UPDATED_ROW, current_quantity: 0, target_quantity: 0 };
    service = new NeedsService(buildUpdateMock({ updateData: updatedRow }));

    const result = await service.updateNeed(NEED_ID, USER_ID, COMMAND);

    expect(result.progress_percentage).toBe(0);
  });

  it("falls back to current timestamp when updated_at is null", async () => {
    const updatedRow = { ...UPDATED_ROW, updated_at: null };
    service = new NeedsService(buildUpdateMock({ updateData: updatedRow as never }));

    const result = await service.updateNeed(NEED_ID, USER_ID, COMMAND);

    // Falls back to new Date().toISOString() — just verify it's a non-empty string
    expect(result.updated_at).toBeTruthy();
    expect(typeof result.updated_at).toBe("string");
  });

  // -------------------------------------------------------------------------
  // NotFoundError paths
  // -------------------------------------------------------------------------

  it("throws NotFoundError when need does not exist or is soft-deleted", async () => {
    service = new NeedsService(buildUpdateMock({ selectData: null }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError with message "Need not found"', async () => {
    service = new NeedsService(buildUpdateMock({ selectData: null }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow("Need not found");
  });

  // -------------------------------------------------------------------------
  // ForbiddenError path
  // -------------------------------------------------------------------------

  it("throws ForbiddenError when authenticated user is not the owner", async () => {
    const otherOwnerNeed = { ...EXISTING_NEED, shelter_id: OTHER_USER_ID };
    service = new NeedsService(buildUpdateMock({ selectData: otherOwnerNeed }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError with ownership message", async () => {
    const otherOwnerNeed = { ...EXISTING_NEED, shelter_id: OTHER_USER_ID };
    service = new NeedsService(buildUpdateMock({ selectData: otherOwnerNeed }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow("You are not the owner of this need");
  });

  // -------------------------------------------------------------------------
  // ValidationError — cross-field quantity check
  // -------------------------------------------------------------------------

  it("throws ValidationError when command's current_quantity > command's target_quantity", async () => {
    const cmd: UpdateNeedCommand = { current_quantity: 150, target_quantity: 100 };
    service = new NeedsService(buildUpdateMock());

    await expect(service.updateNeed(NEED_ID, USER_ID, cmd)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when new current_quantity > existing target_quantity in DB", async () => {
    // EXISTING_NEED has target_quantity: 100; we try to set current to 120
    const cmd: UpdateNeedCommand = { current_quantity: 120 };
    service = new NeedsService(buildUpdateMock());

    await expect(service.updateNeed(NEED_ID, USER_ID, cmd)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when new target_quantity < existing current_quantity in DB", async () => {
    // EXISTING_NEED has current_quantity: 10; we try to set target to 5
    const cmd: UpdateNeedCommand = { target_quantity: 5 };
    service = new NeedsService(buildUpdateMock());

    await expect(service.updateNeed(NEED_ID, USER_ID, cmd)).rejects.toThrow(ValidationError);
  });

  it("does not throw when current_quantity equals target_quantity", async () => {
    const cmd: UpdateNeedCommand = { current_quantity: 100, target_quantity: 100 };
    service = new NeedsService(buildUpdateMock());

    await expect(service.updateNeed(NEED_ID, USER_ID, cmd)).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // InternalError paths
  // -------------------------------------------------------------------------

  it("throws InternalError on SELECT database error", async () => {
    service = new NeedsService(buildUpdateMock({ selectError: { message: "connection refused" } }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message on SELECT error", async () => {
    service = new NeedsService(buildUpdateMock({ selectError: { message: "pg error" } }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow("Unable to retrieve need");
  });

  it("throws InternalError on UPDATE database error", async () => {
    service = new NeedsService(buildUpdateMock({ updateError: { message: "constraint violation", code: "23514" } }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message on UPDATE error", async () => {
    service = new NeedsService(buildUpdateMock({ updateError: { message: "pg error" } }));

    await expect(service.updateNeed(NEED_ID, USER_ID, COMMAND)).rejects.toThrow("Unable to update need");
  });
});

// ---------------------------------------------------------------------------
// deleteNeed tests
// ---------------------------------------------------------------------------

describe("NeedsService.deleteNeed()", () => {
  const NEED_ID = "00000000-0000-0000-0000-000000000099";
  const USER_ID = "00000000-0000-0000-0000-000000000001";
  const NEED_ROW = {
    id: NEED_ID,
    shelter_id: USER_ID,
  };
  const DELETED_AT = "2026-02-25T12:00:00Z";
  const UPDATED_ROW = { deleted_at: DELETED_AT };

  /**
   * Builds a Supabase client mock that handles two sequential `from("needs")` calls:
   *  1. SELECT chain: .select().eq().is().maybeSingle()
   *  2. UPDATE chain: .update().eq().select().single()
   */
  function buildDeleteMock({
    selectData = NEED_ROW as typeof NEED_ROW | null,
    selectError = null as { message: string; code?: string } | null,
    updateData = UPDATED_ROW as typeof UPDATED_ROW | null,
    updateError = null as { message: string; code?: string } | null,
  } = {}) {
    // SELECT chain: .select().eq().is().maybeSingle()
    const maybeSingle = vi.fn().mockResolvedValue({ data: selectData, error: selectError });
    const isNull = vi.fn().mockReturnValue({ maybeSingle });
    const eqSelect = vi.fn().mockReturnValue({ is: isNull });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSelect });

    // UPDATE chain: .update().eq().select().single()
    const single = vi.fn().mockResolvedValue({ data: updateData, error: updateError });
    const selectUpdate = vi.fn().mockReturnValue({ single });
    const eqUpdate = vi.fn().mockReturnValue({ select: selectUpdate });
    const updateFn = vi.fn().mockReturnValue({ eq: eqUpdate });

    const from = vi.fn().mockReturnValueOnce({ select: selectFn }).mockReturnValueOnce({ update: updateFn });

    return { from } as unknown as import("@/db/supabase.client").SupabaseClient;
  }

  let service: NeedsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns NeedDeleteResponseDTO on success", async () => {
    service = new NeedsService(buildDeleteMock());

    const result = await service.deleteNeed(NEED_ID, USER_ID);

    expect(result).toEqual({
      message: "Need successfully deleted",
      deleted_at: DELETED_AT,
    });
  });

  // -------------------------------------------------------------------------
  // NotFoundError paths
  // -------------------------------------------------------------------------

  it("throws NotFoundError when need does not exist", async () => {
    service = new NeedsService(buildDeleteMock({ selectData: null }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError with message "Need not found" when no row returned', async () => {
    service = new NeedsService(buildDeleteMock({ selectData: null }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow("Need not found");
  });

  it("throws NotFoundError when need is already soft-deleted (no row returned for deleted_at IS NULL)", async () => {
    // Already soft-deleted rows are excluded by `.is("deleted_at", null)` – SELECT returns null
    service = new NeedsService(buildDeleteMock({ selectData: null }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });

  // -------------------------------------------------------------------------
  // ForbiddenError path
  // -------------------------------------------------------------------------

  it("throws ForbiddenError when authenticated user is not the owner", async () => {
    const otherOwnerNeed = { ...NEED_ROW, shelter_id: "00000000-0000-0000-0000-000000000002" };
    service = new NeedsService(buildDeleteMock({ selectData: otherOwnerNeed }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow(ForbiddenError);
  });

  it("throws ForbiddenError with ownership message", async () => {
    const otherOwnerNeed = { ...NEED_ROW, shelter_id: "00000000-0000-0000-0000-000000000002" };
    service = new NeedsService(buildDeleteMock({ selectData: otherOwnerNeed }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow("You are not the owner of this need");
  });

  // -------------------------------------------------------------------------
  // InternalError paths
  // -------------------------------------------------------------------------

  it("throws InternalError on SELECT database error", async () => {
    service = new NeedsService(buildDeleteMock({ selectError: { message: "connection refused" } }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message on SELECT error", async () => {
    service = new NeedsService(buildDeleteMock({ selectError: { message: "pg error" } }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow("Unable to retrieve need");
  });

  it("throws InternalError on UPDATE database error", async () => {
    service = new NeedsService(buildDeleteMock({ updateError: { message: "constraint violation", code: "23514" } }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow(InternalError);
  });

  it("throws InternalError with user-friendly message on UPDATE error", async () => {
    service = new NeedsService(buildDeleteMock({ updateError: { message: "pg error" } }));

    await expect(service.deleteNeed(NEED_ID, USER_ID)).rejects.toThrow("Unable to delete need");
  });
});
