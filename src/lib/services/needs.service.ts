/**
 * Needs Service
 * Handles all business logic related to shelter needs
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type { NeedListResponseDTO, NeedListItemDTO, ShelterInfo, Pagination, NeedsQueryParams } from "@/types";

export class NeedsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get list of needs with filtering and pagination
   * Returns needs only from verified shelters, excluding soft-deleted items
   */
  async getNeeds(params: NeedsQueryParams): Promise<NeedListResponseDTO> {
    const { shelter_id, category, urgency, fulfilled, limit = 20, offset = 0 } = params;

    // Build base query - join with profiles to get shelter info and filter by status
    let query = this.supabase
      .from("needs")
      .select(
        `
        id,
        category,
        title,
        description,
        urgency,
        target_quantity,
        current_quantity,
        unit,
        is_fulfilled,
        created_at,
        shelter:profiles!shelter_id (
          id,
          name,
          city
        )
      `,
        { count: "exact" }
      )
      .is("deleted_at", null) // Exclude soft-deleted needs
      .eq("profiles.status", "verified"); // Only verified shelters

    // Apply optional filters
    if (shelter_id) {
      query = query.eq("shelter_id", shelter_id);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (urgency) {
      query = query.eq("urgency", urgency);
    }

    if (fulfilled !== undefined) {
      query = query.eq("is_fulfilled", fulfilled);
    }

    // Apply ordering and pagination
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      throw new Error("Failed to fetch needs from database");
    }

    // Transform database results to DTO format
    const needs: NeedListItemDTO[] = (data ?? []).map((need) => {
      // Calculate progress percentage
      const progress_percentage = Math.round((need.current_quantity / need.target_quantity) * 100);

      // Extract shelter info (Supabase returns nested object or array)
      const shelterData = Array.isArray(need.shelter) ? need.shelter[0] : need.shelter;
      const shelter: ShelterInfo = {
        id: shelterData?.id ?? "",
        name: shelterData?.name ?? "",
        city: shelterData?.city ?? "",
      };

      return {
        id: need.id,
        shelter,
        category: need.category,
        title: need.title,
        description: need.description,
        urgency: need.urgency,
        target_quantity: need.target_quantity,
        current_quantity: need.current_quantity,
        unit: need.unit,
        progress_percentage,
        is_fulfilled: need.is_fulfilled,
        created_at: need.created_at,
      };
    });

    // Construct pagination metadata
    const pagination: Pagination = {
      total: count ?? 0,
      limit,
      offset,
    };

    return {
      data: needs,
      pagination,
    };
  }
}
