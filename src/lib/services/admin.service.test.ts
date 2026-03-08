import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminService } from "./admin.service";
import { InternalError, NotFoundError, ValidationError } from "@/lib/errors";
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

    await expect(service.getPendingShelters({ limit: 20, offset: 0 })).rejects.toThrow(
      "Failed to fetch pending shelters"
    );
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

// ---------------------------------------------------------------------------
// AdminService.updateShelterStatus()
// ---------------------------------------------------------------------------

const SHELTER_ID = "00000000-0000-0000-0000-000000000010";

function buildUpdateStatusMock({
  selectData = { id: SHELTER_ID, rejection_reason: null } as { id: string; rejection_reason: string | null } | null,
  selectError = null as { message: string } | null,
  updateData = { id: SHELTER_ID, status: "verified", updated_at: "2026-02-22T12:00:00Z" } as {
    id: string;
    status: string;
    updated_at: string;
  } | null,
  updateError = null as { message: string } | null,
} = {}) {
  // SELECT chain: .from().select("id").eq("id").eq("role").maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: selectData, error: selectError });
  const eqRole = vi.fn().mockReturnValue({ maybeSingle });
  const eqId = vi.fn().mockReturnValue({ eq: eqRole });
  const selectChain = vi.fn().mockReturnValue({ eq: eqId });

  // UPDATE chain: .from().update().eq("id").select().single()
  const single = vi.fn().mockResolvedValue({ data: updateData, error: updateError });
  const selectAfterUpdate = vi.fn().mockReturnValue({ single });
  const eqForUpdate = vi.fn().mockReturnValue({ select: selectAfterUpdate });
  const updateChain = vi.fn().mockReturnValue({ eq: eqForUpdate });

  const from = vi.fn().mockReturnValue({ select: selectChain, update: updateChain });

  return { from, __updateChain: updateChain } as unknown as SupabaseClient & { __updateChain: typeof updateChain };
}

describe("AdminService.updateShelterStatus()", () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Success — happy path
  // -------------------------------------------------------------------------

  it("returns ShelterStatusUpdateResponseDTO on successful update to 'verified'", async () => {
    const supabase = buildUpdateStatusMock({
      updateData: { id: SHELTER_ID, status: "verified", updated_at: "2026-02-22T12:00:00Z" },
    });
    service = new AdminService(supabase);

    const result = await service.updateShelterStatus(SHELTER_ID, { status: "verified" });

    expect(result).toEqual({ id: SHELTER_ID, status: "verified", updated_at: "2026-02-22T12:00:00Z" });
  });

  it("returns correct DTO when status is set to 'rejected'", async () => {
    const supabase = buildUpdateStatusMock({
      updateData: { id: SHELTER_ID, status: "rejected", updated_at: "2026-02-22T13:00:00Z" },
    });
    service = new AdminService(supabase);

    const result = await service.updateShelterStatus(SHELTER_ID, {
      status: "rejected",
      rejection_reason: "Documents are invalid",
    });

    expect(result.status).toBe("rejected");
    expect(result.id).toBe(SHELTER_ID);
  });

  it("persists rejection_reason when status is set to 'rejected'", async () => {
    const supabase = buildUpdateStatusMock();
    service = new AdminService(supabase);

    await service.updateShelterStatus(SHELTER_ID, {
      status: "rejected",
      rejection_reason: "  Dokument nie potwierdza umocowania placowki.  ",
    });

    expect(supabase.__updateChain).toHaveBeenCalledWith({
      status: "rejected",
      rejection_reason: "Dokument nie potwierdza umocowania placowki.",
    });
  });

  it("throws ValidationError when trimmed rejection_reason is shorter than 3 characters", async () => {
    const supabase = buildUpdateStatusMock();
    service = new AdminService(supabase);

    const resultPromise = service.updateShelterStatus(SHELTER_ID, {
      status: "rejected",
      rejection_reason: "  ab  ",
    });

    await expect(resultPromise).rejects.toThrow(ValidationError);
    await expect(resultPromise).rejects.toThrow("Rejection reason must be at least 3 characters");

    expect(supabase.__updateChain).not.toHaveBeenCalled();
  });

  it("clears rejection_reason when status changes to 'verified'", async () => {
    const supabase = buildUpdateStatusMock();
    service = new AdminService(supabase);

    await service.updateShelterStatus(SHELTER_ID, { status: "verified" });

    expect(supabase.__updateChain).toHaveBeenCalledWith({
      status: "verified",
      rejection_reason: null,
    });
  });

  it("returns correct DTO when status is set to 'suspended'", async () => {
    const supabase = buildUpdateStatusMock({
      selectData: { id: SHELTER_ID, rejection_reason: "Poprzedni powód odrzucenia" },
      updateData: { id: SHELTER_ID, status: "suspended", updated_at: "2026-02-22T14:00:00Z" },
    });
    service = new AdminService(supabase);

    const result = await service.updateShelterStatus(SHELTER_ID, { status: "suspended" });

    expect(result.status).toBe("suspended");
    expect(supabase.__updateChain).toHaveBeenCalledWith({
      status: "suspended",
      rejection_reason: "Poprzedni powód odrzucenia",
    });
  });

  // -------------------------------------------------------------------------
  // NotFoundError — shelter does not exist
  // -------------------------------------------------------------------------

  it("throws NotFoundError when shelter profile does not exist", async () => {
    const supabase = buildUpdateStatusMock({ selectData: null });
    service = new AdminService(supabase);

    await expect(service.updateShelterStatus(SHELTER_ID, { status: "verified" })).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError with message 'Shelter not found'", async () => {
    const supabase = buildUpdateStatusMock({ selectData: null });
    service = new AdminService(supabase);

    await expect(service.updateShelterStatus(SHELTER_ID, { status: "verified" })).rejects.toThrow("Shelter not found");
  });

  // -------------------------------------------------------------------------
  // InternalError — database failures
  // -------------------------------------------------------------------------

  it("throws InternalError when SELECT returns a database error", async () => {
    const supabase = buildUpdateStatusMock({ selectError: { message: "connection timeout" } });
    service = new AdminService(supabase);

    await expect(service.updateShelterStatus(SHELTER_ID, { status: "verified" })).rejects.toThrow(InternalError);
  });

  it("includes Supabase error message in InternalError on SELECT failure", async () => {
    const supabase = buildUpdateStatusMock({ selectError: { message: "connection timeout" } });
    service = new AdminService(supabase);

    await expect(service.updateShelterStatus(SHELTER_ID, { status: "verified" })).rejects.toThrow(
      "Failed to fetch shelter"
    );
  });

  it("throws InternalError when UPDATE returns a database error", async () => {
    const supabase = buildUpdateStatusMock({ updateError: { message: "deadlock detected" } });
    service = new AdminService(supabase);

    await expect(service.updateShelterStatus(SHELTER_ID, { status: "verified" })).rejects.toThrow(InternalError);
  });

  it("throws InternalError when UPDATE returns null data", async () => {
    const supabase = buildUpdateStatusMock({ updateData: null });
    service = new AdminService(supabase);

    await expect(service.updateShelterStatus(SHELTER_ID, { status: "verified" })).rejects.toThrow(InternalError);
  });

  // -------------------------------------------------------------------------
  // DB call arguments
  // -------------------------------------------------------------------------

  it("queries profiles with correct shelterId and role='shelter' during existence check", async () => {
    const supabase = buildUpdateStatusMock();
    service = new AdminService(supabase);

    await service.updateShelterStatus(SHELTER_ID, { status: "verified" });

    expect(supabase.from).toHaveBeenCalledWith("profiles");
  });
});
// ---------------------------------------------------------------------------
// AdminService.getVerificationDocument()
// ---------------------------------------------------------------------------

const DOC_SHELTER_ID = "00000000-0000-0000-0000-000000000020";
const DOC_PATH = "verification-docs/shelter-20/document.pdf";

/**
 * Builds a Supabase mock tailored for the getVerificationDocument() path:
 *   - .from("profiles").select(...).eq("id", ...).maybeSingle()
 *   - .storage.from("verification-documents").download(path)
 */
function buildGetDocumentMock({
  shelterData = { id: DOC_SHELTER_ID, verification_doc_path: DOC_PATH } as {
    id: string;
    verification_doc_path: string | null;
  } | null,
  shelterError = null as { message: string } | null,
  storageBlob = new Blob(["PDF content"], { type: "application/pdf" }) as Blob | null,
  storageError = null as { message: string } | null,
} = {}) {
  // DB chain: .from("profiles").select().eq("id", ...).maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: shelterData, error: shelterError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  // Storage chain: .storage.from("verification-documents").download(path)
  const download = vi.fn().mockResolvedValue({ data: storageBlob, error: storageError });
  const storageBucket = vi.fn().mockReturnValue({ download });
  const storage = { from: storageBucket };

  return { from, storage } as unknown as SupabaseClient;
}

describe("AdminService.getVerificationDocument()", () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns VerificationDocumentResult with correct data on success", async () => {
    const blob = new Blob(["PDF content"]);
    const supabase = buildGetDocumentMock({ storageBlob: blob });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.data).toBe(blob);
    expect(result.fileName).toBe("document.pdf");
    expect(result.contentType).toBe("application/pdf");
  });

  it("derives correct Content-Type for .jpg files", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/shelter-20/photo.jpg" },
    });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.contentType).toBe("image/jpeg");
    expect(result.fileName).toBe("photo.jpg");
  });

  it("derives correct Content-Type for .jpeg files", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/shelter-20/photo.jpeg" },
    });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.contentType).toBe("image/jpeg");
  });

  it("derives correct Content-Type for .png files", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/shelter-20/image.png" },
    });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.contentType).toBe("image/png");
  });

  it("derives correct Content-Type for .webp files", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/shelter-20/image.webp" },
    });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.contentType).toBe("image/webp");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/shelter-20/archive.zip" },
    });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.contentType).toBe("application/octet-stream");
  });

  it("accepts verification paths with spaces when they stay inside the expected storage prefix", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/1/1700000000-My document.pdf" },
    });
    service = new AdminService(supabase);

    const result = await service.getVerificationDocument(DOC_SHELTER_ID);

    expect(result.fileName).toBe("1700000000-My document.pdf");
    expect(result.contentType).toBe("application/pdf");
  });

  // -------------------------------------------------------------------------
  // NotFoundError — shelter does not exist
  // -------------------------------------------------------------------------

  it("throws NotFoundError when shelter profile does not exist", async () => {
    const supabase = buildGetDocumentMock({ shelterData: null });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError with 'Shelter not found' message when shelter is missing", async () => {
    const supabase = buildGetDocumentMock({ shelterData: null });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow("Shelter not found");
  });

  // -------------------------------------------------------------------------
  // NotFoundError — verification_doc_path is null
  // -------------------------------------------------------------------------

  it("throws NotFoundError when verification_doc_path is null", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: null },
    });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError with 'Verification document not found' when path is null", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: null },
    });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow("Verification document not found");
  });

  // -------------------------------------------------------------------------
  // InternalError — database failure
  // -------------------------------------------------------------------------

  it("throws InternalError when the DB query fails", async () => {
    const supabase = buildGetDocumentMock({ shelterError: { message: "connection refused" } });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(InternalError);
  });

  it("includes Supabase DB error message in InternalError", async () => {
    const supabase = buildGetDocumentMock({ shelterError: { message: "connection refused" } });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow("Failed to retrieve shelter data");
  });

  // -------------------------------------------------------------------------
  // NotFoundError — storage file not found
  // -------------------------------------------------------------------------

  it("throws NotFoundError when storage returns a 'not found' error", async () => {
    const supabase = buildGetDocumentMock({ storageError: { message: "Object not found" } });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError with appropriate message when storage file is missing", async () => {
    const supabase = buildGetDocumentMock({ storageError: { message: "Object not found" } });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(
      "Verification document file not found"
    );
  });

  // -------------------------------------------------------------------------
  // InternalError — storage generic failure
  // -------------------------------------------------------------------------

  it("throws InternalError when storage returns a non-404 error", async () => {
    const supabase = buildGetDocumentMock({ storageError: { message: "internal storage error" } });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(InternalError);
  });

  it("includes storage error message in InternalError for generic storage failures", async () => {
    const supabase = buildGetDocumentMock({ storageError: { message: "internal storage error" } });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow(
      "Failed to download verification document"
    );
  });

  it("rejects traversal attempts in verification document paths", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/1/../secrets.txt" },
    });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow("Invalid verification document path");
  });

  it("rejects verification document paths outside the expected prefix", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "other-prefix/1/document.pdf" },
    });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow("Invalid verification document path");
  });

  it("rejects verification document paths containing DEL characters", async () => {
    const supabase = buildGetDocumentMock({
      shelterData: { id: DOC_SHELTER_ID, verification_doc_path: "verification-docs/1/docfile.pdf" },
    });
    service = new AdminService(supabase);

    await expect(service.getVerificationDocument(DOC_SHELTER_ID)).rejects.toThrow("Invalid verification document path");
  });
});
