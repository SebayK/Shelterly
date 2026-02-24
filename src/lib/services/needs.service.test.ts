import { describe, it, expect, vi, beforeEach } from "vitest";
import { NeedsService } from "./needs.service";
import { InternalError, NotFoundError, ForbiddenError } from "@/lib/errors";
import type { CreateNeedCommand } from "@/types";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
