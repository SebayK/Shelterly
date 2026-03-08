/**
 * Admin Service
 * Handles business logic for super_admin operations, such as managing
 * pending shelter verifications.
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type {
  PendingShelterListResponseDTO,
  PendingShelterListItemDTO,
  ShelterStatusUpdateResponseDTO,
  UpdateShelterStatusCommand,
} from "@/types";
import { InternalError, NotFoundError, ValidationError } from "@/lib/errors";
import { APP_CONFIG } from "@/lib/config";

/**
 * Result of fetching a verification document from storage.
 */
export interface VerificationDocumentResult {
  data: Blob;
  fileName: string;
  contentType: string;
}

/**
 * Derives the MIME type from a file name's extension.
 * Falls back to `application/octet-stream` for unknown types.
 */
function getContentTypeFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * Returns true when the storage key is relative and cannot escape via traversal.
 */
function isValidStoragePath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\") || !path.startsWith("verification-docs/")) {
    return false;
  }

  const hasControlCharacter = Array.from(path).some((character) => {
    const charCode = character.charCodeAt(0);
    return charCode < 32 || charCode === 127;
  });
  if (hasControlCharacter) {
    return false;
  }

  const segments = path.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

/**
 * Raw row returned by the get_pending_shelters_with_email RPC function.
 * The function uses SECURITY DEFINER to safely join auth.users for the email field.
 */
interface PendingShelterRPCRow {
  id: string;
  name: string | null;
  nip: string | null;
  city: string | null;
  email: string;
  verification_doc_path: string | null;
  created_at: string;
  total_count: number;
}

export class AdminService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Fetches a paginated list of shelters pending verification.
   * Calls the `get_pending_shelters_with_email` RPC function which securely
   * joins auth.users to include email without exposing service role credentials.
   *
   * @param params - Pagination parameters (limit, offset)
   * @returns Paginated list of pending shelters with email included
   * @throws InternalError if the RPC call fails
   */
  async getPendingShelters(params: { limit: number; offset: number }): Promise<PendingShelterListResponseDTO> {
    const { limit, offset } = params;

    const { data, error } = await this.supabase.rpc("get_pending_shelters_with_email", {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new InternalError("Failed to fetch pending shelters");
    }

    const rows = (data ?? []) as PendingShelterRPCRow[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const shelters: PendingShelterListItemDTO[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      nip: row.nip,
      city: row.city,
      email: row.email,
      verification_doc_path: row.verification_doc_path,
      created_at: row.created_at,
    }));

    return {
      data: shelters,
      pagination: {
        total,
        limit,
        offset,
      },
    };
  }

  /**
   * Updates the verification status of a shelter.
   * Only `verified`, `rejected`, and `suspended` statuses are allowed.
   * Rejected shelters store an actionable `rejection_reason`.
   * The reason is exposed back to the shelter in the remediation flow.
   *
   * @param shelterId - UUID of the shelter profile to update
   * @param command - Command containing the new status (and optional rejection_reason)
   * @returns Updated shelter status DTO
   * @throws NotFoundError if no shelter profile with the given ID exists
   * @throws InternalError on database failure
   */
  async updateShelterStatus(
    shelterId: string,
    command: UpdateShelterStatusCommand
  ): Promise<ShelterStatusUpdateResponseDTO> {
    // 1. Verify the shelter exists and has role = 'shelter'
    const { data: existing, error: selectError } = await this.supabase
      .from("profiles")
      .select("id, rejection_reason")
      .eq("id", shelterId)
      .eq("role", "shelter")
      .maybeSingle();

    if (selectError) {
      throw new InternalError("Failed to fetch shelter");
    }

    if (!existing) {
      throw new NotFoundError("Shelter not found");
    }

    const rejectionReason =
      command.status === "rejected"
        ? (command.rejection_reason?.trim() ?? null)
        : command.status === "verified"
          ? null
          : (existing.rejection_reason ?? null);

    if (command.status === "rejected") {
      if (!rejectionReason) {
        throw new ValidationError("Rejection reason is required when status is 'rejected'");
      }

      if (rejectionReason.length < 3) {
        throw new ValidationError("Rejection reason must be at least 3 characters");
      }

      if (rejectionReason.length > 500) {
        throw new ValidationError("Rejection reason must not exceed 500 characters");
      }
    }

    // 2. Update status and only clear rejection reasons when the shelter is verified again
    const { data: updated, error: updateError } = await this.supabase
      .from("profiles")
      .update({ status: command.status, rejection_reason: rejectionReason })
      .eq("id", shelterId)
      .select("id, status, updated_at")
      .single();

    if (updateError || !updated) {
      throw new InternalError("Failed to update shelter status");
    }

    return {
      id: updated.id,
      status: updated.status,
      // updated_at is guaranteed non-null immediately after an UPDATE
      updated_at: updated.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * Downloads the verification document for a given shelter from Supabase Storage.
   *
   * @param shelterId - UUID of the shelter whose document should be retrieved
   * @returns An object with the file Blob, its filename, and the resolved MIME type
   * @throws NotFoundError if the shelter doesn't exist, has no document path, or the file is missing in storage
   * @throws InternalError on database or storage failures
   */
  async getVerificationDocument(shelterId: string): Promise<VerificationDocumentResult> {
    // 1. Fetch the shelter profile — only id and verification_doc_path are needed
    const { data: shelter, error: dbError } = await this.supabase
      .from("profiles")
      .select("id, verification_doc_path")
      .eq("id", shelterId)
      .maybeSingle();

    if (dbError) {
      throw new InternalError("Failed to retrieve shelter data");
    }

    if (!shelter) {
      throw new NotFoundError("Shelter not found");
    }

    if (!shelter.verification_doc_path) {
      throw new NotFoundError("Verification document not found");
    }

    const docPath = shelter.verification_doc_path;

    // 2. Guard against path traversal before touching storage
    if (!isValidStoragePath(docPath)) {
      throw new InternalError("Invalid verification document path");
    }

    // 3. Download the file from Supabase Storage
    const { data: blob, error: storageError } = await this.supabase.storage
      .from(APP_CONFIG.STORAGE_BUCKET)
      .download(docPath);

    if (storageError) {
      // Supabase Storage returns "Object not found" (or similar) when the file is missing
      const isNotFound =
        storageError.message.toLowerCase().includes("not found") ||
        storageError.message.toLowerCase().includes("does not exist");

      if (isNotFound) {
        throw new NotFoundError("Verification document file not found");
      }

      throw new InternalError("Failed to download verification document");
    }

    // 4. Derive metadata from the storage path
    const fileName = docPath.split("/").pop() ?? "document";
    const contentType = getContentTypeFromFileName(fileName);

    return { data: blob, fileName, contentType };
  }
}
