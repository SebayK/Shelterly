/**
 * Needs Service
 * Handles all business logic related to shelter needs
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type {
  NeedListResponseDTO,
  NeedListItemDTO,
  NeedDetailDTO,
  NeedCreateResponseDTO,
  NeedFulfillResponseDTO,
  NeedUpdateResponseDTO,
  NeedDeleteResponseDTO,
  CreateNeedCommand,
  UpdateNeedCommand,
  ShelterInfo,
  ShelterDetailInfo,
  Pagination,
  NeedsQueryParams,
} from "@/types";
import {
  InternalError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  logError,
  logErrorWithContext,
  logSuccess,
} from "@/lib/errors";

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
        profiles!inner (
          id,
          name,
          city,
          status
        )
      `,
        { count: "exact" }
      )
      .is("deleted_at", null) // Exclude soft-deleted needs
      .filter("profiles.status", "eq", "verified"); // Only verified shelters

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
      logError("[NeedsService.getNeeds]", error);
      throw new InternalError("Unable to retrieve shelter needs");
    }

    // Transform database results to DTO format
    const needs: NeedListItemDTO[] = (data ?? []).flatMap((need) => {
      // Calculate progress percentage with safety check for division by zero
      const progress_percentage =
        need.target_quantity > 0 ? Math.round((need.current_quantity / need.target_quantity) * 100) : 0;

      // Extract shelter info (Supabase returns nested object or array)
      const shelterData = Array.isArray(need.profiles) ? need.profiles[0] : need.profiles;

      // Skip records with missing shelter data instead of failing the whole request
      if (!shelterData || !shelterData.id || !shelterData.name || !shelterData.city) {
        logError("[NeedsService.getNeeds] Inconsistent data", {
          message: "Missing or incomplete shelter profile for need — skipping record",
          needId: need.id,
          profiles: need.profiles,
        });
        return [];
      }

      const shelter: ShelterInfo = {
        id: shelterData.id,
        name: shelterData.name,
        city: shelterData.city,
      };

      return [
        {
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
        },
      ];
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

  /**
   * Get a single need by ID
   * Returns need detail only if active (not soft-deleted) and belonging to a verified shelter
   * @throws NotFoundError when the need does not exist, is deleted, or shelter is not verified
   * @throws InternalError on database errors or inconsistent relational data
   */
  async getNeedById(id: string): Promise<NeedDetailDTO> {
    const { data, error } = await this.supabase
      .from("needs")
      .select(
        `
        id,
        category,
        title,
        description,
        shopping_url,
        urgency,
        target_quantity,
        current_quantity,
        unit,
        is_fulfilled,
        created_at,
        updated_at,
        profiles!inner (
          id,
          name,
          city,
          phone_number,
          status
        )
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .filter("profiles.status", "eq", "verified")
      .maybeSingle();

    if (error) {
      logError("[NeedsService.getNeedById]", error);
      throw new InternalError("Unable to retrieve need details");
    }

    if (!data) {
      throw new NotFoundError("Need not found or deleted");
    }

    // Extract shelter info from potentially nested Supabase response
    const shelterData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

    if (!shelterData || !shelterData.id || !shelterData.name || !shelterData.city) {
      logError("[NeedsService.getNeedById] Inconsistent data", {
        message: "Missing or incomplete shelter profile for need",
        needId: data.id,
        profiles: data.profiles,
      });
      throw new InternalError("Failed to fetch need: missing shelter profile data");
    }

    const shelter: ShelterDetailInfo = {
      id: shelterData.id,
      name: shelterData.name,
      city: shelterData.city,
      phone_number: shelterData.phone_number ?? null,
    };

    const progress_percentage =
      data.target_quantity > 0 ? Math.round((data.current_quantity / data.target_quantity) * 100) : 0;

    return {
      id: data.id,
      shelter,
      category: data.category,
      title: data.title,
      description: data.description,
      shopping_url: data.shopping_url ?? null,
      urgency: data.urgency,
      target_quantity: data.target_quantity,
      current_quantity: data.current_quantity,
      unit: data.unit,
      progress_percentage,
      is_fulfilled: data.is_fulfilled,
      created_at: data.created_at,
      updated_at: data.updated_at ?? null,
    };
  }

  /**
   * Create a new need for a shelter
   * Only verified shelters can create needs
   * @param shelterId - UUID of the authenticated shelter's profile
   * @param command - Validated need creation data
   * @returns Created need with all persisted fields
   * @throws InternalError on database errors
   */
  async createNeed(shelterId: string, command: CreateNeedCommand): Promise<NeedCreateResponseDTO> {
    const { data, error } = await this.supabase
      .from("needs")
      .insert({
        shelter_id: shelterId,
        category: command.category,
        title: command.title,
        description: command.description ?? null,
        shopping_url: command.shopping_url ?? null,
        urgency: command.urgency,
        target_quantity: command.target_quantity,
        unit: command.unit,
        // current_quantity defaults to 0, is_fulfilled defaults to false in DB
      })
      .select(
        "id, shelter_id, category, title, description, shopping_url, urgency, target_quantity, current_quantity, unit, is_fulfilled, created_at"
      )
      .single();

    if (error) {
      logErrorWithContext(
        {
          endpoint: "POST /api/needs",
          shelter_id: shelterId,
          // Log only safe, non-sensitive fields from the command
          request_body: {
            category: command.category,
            urgency: command.urgency,
            unit: command.unit,
            target_quantity: command.target_quantity,
          },
          constraint: (error as { code?: string }).code,
        },
        error
      );
      throw new InternalError("Unable to create need");
    }

    return {
      id: data.id,
      shelter_id: data.shelter_id,
      category: data.category,
      title: data.title,
      description: data.description,
      shopping_url: data.shopping_url ?? null,
      urgency: data.urgency,
      target_quantity: data.target_quantity,
      current_quantity: data.current_quantity,
      unit: data.unit,
      is_fulfilled: data.is_fulfilled,
      created_at: data.created_at,
    };
  }

  /**
   * Mark a need as fulfilled
   * Only the shelter that owns the need can fulfill it
   * Needs already fulfilled or soft-deleted are treated as not found
   * @param needId - UUID of the need to fulfill
   * @param userId - UUID of the authenticated user (shelter owner)
   * @returns NeedFulfillResponseDTO with updated id, is_fulfilled and updated_at
   * @throws NotFoundError when need does not exist, is soft-deleted, or already fulfilled
   * @throws ForbiddenError when the authenticated user is not the owner of the need
   * @throws InternalError on database errors
   */
  async fulfillNeed(needId: string, userId: string): Promise<NeedFulfillResponseDTO> {
    // 1. Fetch the need — exclude soft-deleted records
    const { data: need, error: selectError } = await this.supabase
      .from("needs")
      .select("id, shelter_id, is_fulfilled")
      .eq("id", needId)
      .is("deleted_at", null)
      .maybeSingle();

    if (selectError) {
      logErrorWithContext(
        {
          endpoint: "POST /api/needs/:id/fulfill",
          user_id: userId,
          need_id: needId,
        },
        selectError
      );
      throw new InternalError("Unable to retrieve need");
    }

    // 2. Need not found or soft-deleted
    if (!need) {
      throw new NotFoundError("Need not found");
    }

    // 3. Authorization — only the owner can fulfill
    if (need.shelter_id !== userId) {
      throw new ForbiddenError("You are not the owner of this need");
    }

    // 4. Already fulfilled — treat as not actionable (consistent with API convention)
    if (need.is_fulfilled) {
      throw new NotFoundError("Need is already fulfilled");
    }

    // 5. Update the need
    const { data: updated, error: updateError } = await this.supabase
      .from("needs")
      .update({ is_fulfilled: true })
      .eq("id", needId)
      .select("id, is_fulfilled, updated_at")
      .single();

    if (updateError) {
      logErrorWithContext(
        {
          endpoint: "POST /api/needs/:id/fulfill",
          user_id: userId,
          need_id: needId,
          constraint: (updateError as { code?: string }).code,
        },
        updateError
      );
      throw new InternalError("Unable to fulfill need");
    }

    return {
      id: updated.id,
      is_fulfilled: updated.is_fulfilled,
      updated_at: updated.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * Update an existing need (partial update)
   * Only the shelter owner with status `verified` can update its own needs.
   * Soft-deleted needs are treated as non-existent (404).
   *
   * Cross-field validation when only one of the quantity fields is provided:
   * - Updating current_quantity only → fetched target_quantity from DB used for comparison.
   * - Updating target_quantity only → fetched current_quantity from DB used for comparison.
   *
   * @param needId  - UUID of the need to update
   * @param userId  - UUID of the authenticated user (must be the shelter owner)
   * @param command - Partial update payload (all fields optional, at least one required)
   * @returns NeedUpdateResponseDTO with the updated fields plus computed progress_percentage
   * @throws NotFoundError   when need does not exist or is soft-deleted
   * @throws ForbiddenError  when the authenticated user is not the owner
   * @throws ValidationError when current_quantity would exceed target_quantity after the update
   * @throws InternalError   on database errors
   */
  async updateNeed(needId: string, userId: string, command: UpdateNeedCommand): Promise<NeedUpdateResponseDTO> {
    // 1. Fetch the existing need — exclude soft-deleted records
    const { data: need, error: selectError } = await this.supabase
      .from("needs")
      .select("id, shelter_id, target_quantity, current_quantity")
      .eq("id", needId)
      .is("deleted_at", null)
      .maybeSingle();

    if (selectError) {
      logErrorWithContext({ endpoint: "PATCH /api/needs/:id", user_id: userId, need_id: needId }, selectError);
      throw new InternalError("Unable to retrieve need");
    }

    // 2. Not found or soft-deleted
    if (!need) {
      throw new NotFoundError("Need not found");
    }

    // 3. Authorisation — only the owner can update
    if (need.shelter_id !== userId) {
      throw new ForbiddenError("You are not the owner of this need");
    }

    // 4. Cross-field quantity validation using effective (post-update) values
    const effectiveTarget = command.target_quantity ?? need.target_quantity;
    const effectiveCurrent = command.current_quantity ?? need.current_quantity;

    if (effectiveCurrent > effectiveTarget) {
      throw new ValidationError("current_quantity must be less than or equal to target_quantity");
    }

    // 5. Perform the update and return the updated record
    const { data: updated, error: updateError } = await this.supabase
      .from("needs")
      .update({
        ...(command.title !== undefined && { title: command.title }),
        ...(command.description !== undefined && { description: command.description }),
        ...(command.shopping_url !== undefined && { shopping_url: command.shopping_url }),
        ...(command.urgency !== undefined && { urgency: command.urgency }),
        ...(command.current_quantity !== undefined && { current_quantity: command.current_quantity }),
        ...(command.target_quantity !== undefined && { target_quantity: command.target_quantity }),
        ...(command.category !== undefined && { category: command.category }),
        ...(command.unit !== undefined && { unit: command.unit }),
      })
      .eq("id", needId)
      .select("id, title, description, urgency, current_quantity, target_quantity, updated_at")
      .single();

    if (updateError) {
      logErrorWithContext(
        {
          endpoint: "PATCH /api/needs/:id",
          user_id: userId,
          need_id: needId,
          constraint: (updateError as { code?: string }).code,
        },
        updateError
      );
      throw new InternalError("Unable to update need");
    }

    logSuccess("[NeedsService.updateNeed]", { need_id: updated.id, user_id: userId });

    const progress_percentage =
      updated.target_quantity > 0 ? Math.round((updated.current_quantity / updated.target_quantity) * 100) : 0;

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      urgency: updated.urgency,
      current_quantity: updated.current_quantity,
      progress_percentage,
      updated_at: updated.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * Soft-delete a need by setting `deleted_at` to the current timestamp.
   * Only the shelter that owns the need may delete it.
   * Attempts to delete an already soft-deleted (or non-existent) need result in NotFoundError.
   *
   * @param needId - UUID of the need to delete
   * @param userId - UUID of the authenticated user (must be the shelter owner)
   * @returns NeedDeleteResponseDTO with a confirmation message and the deletion timestamp
   * @throws NotFoundError  when need does not exist or is already soft-deleted
   * @throws ForbiddenError when the authenticated user is not the owner
   * @throws InternalError  on database errors
   */
  async deleteNeed(needId: string, userId: string): Promise<NeedDeleteResponseDTO> {
    // 1. Fetch the need — exclude already soft-deleted records
    const { data: need, error: selectError } = await this.supabase
      .from("needs")
      .select("id, shelter_id")
      .eq("id", needId)
      .is("deleted_at", null)
      .maybeSingle();

    if (selectError) {
      logErrorWithContext({ endpoint: "DELETE /api/needs/:id", user_id: userId, need_id: needId }, selectError);
      throw new InternalError("Unable to retrieve need");
    }

    // 2. Not found or already soft-deleted
    if (!need) {
      throw new NotFoundError("Need not found");
    }

    // 3. Authorisation — only the owner may delete
    if (need.shelter_id !== userId) {
      throw new ForbiddenError("You are not the owner of this need");
    }

    // 4. Perform soft delete — set deleted_at and return the timestamp
    const { data: deleted, error: updateError } = await this.supabase
      .from("needs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", needId)
      .select("deleted_at")
      .single();

    if (updateError) {
      logErrorWithContext(
        {
          endpoint: "DELETE /api/needs/:id",
          user_id: userId,
          need_id: needId,
          constraint: (updateError as { code?: string }).code,
        },
        updateError
      );
      throw new InternalError("Unable to delete need");
    }

    logSuccess("[NeedsService.deleteNeed]", { need_id: needId, user_id: userId });

    return {
      message: "Need successfully deleted",
      deleted_at: deleted.deleted_at ?? new Date().toISOString(),
    };
  }
}
