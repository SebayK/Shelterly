/**
 * Admin Service
 * Handles business logic for super_admin operations, such as managing
 * pending shelter verifications.
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type { PendingShelterListResponseDTO, PendingShelterListItemDTO } from "@/types";
import { InternalError } from "@/lib/errors";

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
      throw new InternalError(`Failed to fetch pending shelters: ${error.message}`);
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
}
