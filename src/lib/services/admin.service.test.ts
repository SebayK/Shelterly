import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminService } from "./admin.service";
import { InternalError } from "@/lib/errors";
import type { SupabaseClient } from "@/db/supabase.client";

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function buildSupabaseMock({
  data = null,
  error = null,
}: {
  data?: Record<string, unknown>[] | null;
  error?: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RPC_ROWS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Schronisko Alfa",
    nip: "1234567890",
    city: "Warszawa",
    email: "alfa@shelter.pl",
    verification_doc_path: "verification-docs/1/doc.pdf",
    created_at: "2026-01-20T10:00:00Z",
    total_count: 2,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Schronisko Beta",
    nip: "0987654321",
    city: "Kraków",
    email: "beta@shelter.pl",
    verification_doc_path: null,
    created_at: "2026-01-19T08:00:00Z",
    total_count: 2,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminService.getPendingShelters()", () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Success — non-empty list
  // -------------------------------------------------------------------------

  it("returns correctly mapped PendingShelterListResponseDTO with rows", async () => {
    service = new AdminService(buildSupabaseMock({ data: RPC_ROWS }));

    const result = await service.getPendingShelters({ limit: 20, offset: 0 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      name: "Schronisko Alfa",
      nip: "1234567890",
      city: "Warszawa",
      email: "alfa@shelter.pl",
      verification_doc_path: "verification-docs/1/doc.pdf",
      created_at: "2026-01-20T10:00:00Z",
    });
    expect(result.data[1]).toEqual({
      id: "00000000-0000-0000-0000-000000000002",
      name: "Schronisko Beta",
      nip: "0987654321",
      city: "Kraków",
      email: "beta@shelter.pl",
      verification_doc_path: null,
      created_at: "2026-01-19T08:00:00Z",
    });
  });

  it("derives pagination.total from total_count of the first row", async () => {
    service = new AdminService(buildSupabaseMock({ data: RPC_ROWS }));

    const result = await service.getPendingShelters({ limit: 20, offset: 0 });

    expect(result.pagination).toEqual({ total: 2, limit: 20, offset: 0 });
  });

  it("reflects custom limit and offset in pagination", async () => {
    service = new AdminService(buildSupabaseMock({ data: [RPC_ROWS[0]] }));

    const result = await service.getPendingShelters({ limit: 1, offset: 1 });

    expect(result.pagination).toEqual({ total: 2, limit: 1, offset: 1 });
  });

  // -------------------------------------------------------------------------
  // Success — empty list
  // -------------------------------------------------------------------------

  it("returns empty data array and total 0 when RPC returns empty array", async () => {
    service = new AdminService(buildSupabaseMock({ data: [] }));

    const result = await service.getPendingShelters({ limit: 20, offset: 0 });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it("handles null data from RPC gracefully (treats as empty list)", async () => {
    service = new AdminService(buildSupabaseMock({ data: null }));

    const result = await service.getPendingShelters({ limit: 20, offset: 0 });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Error path
  // -------------------------------------------------------------------------

  it("throws InternalError when RPC returns an error", async () => {
    service = new AdminService(buildSupabaseMock({ error: { message: "Connection timeout" } }));

    await expect(service.getPendingShelters({ limit: 20, offset: 0 })).rejects.toThrow(InternalError);
  });

  it("includes the Supabase error message in the thrown InternalError", async () => {
    service = new AdminService(buildSupabaseMock({ error: { message: "permission denied" } }));

    await expect(service.getPendingShelters({ limit: 20, offset: 0 })).rejects.toThrow("permission denied");
  });

  // -------------------------------------------------------------------------
  // RPC call arguments
  // -------------------------------------------------------------------------

  it("calls RPC with correct p_limit and p_offset arguments", async () => {
    const supabase = buildSupabaseMock({ data: [] });
    service = new AdminService(supabase);

    await service.getPendingShelters({ limit: 10, offset: 30 });

    expect(supabase.rpc).toHaveBeenCalledWith("get_pending_shelters_with_email", {
      p_limit: 10,
      p_offset: 30,
    });
  });
});
