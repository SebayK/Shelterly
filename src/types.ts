/**
 * Shared types for backend and frontend (Entities, DTOs, Command Models)
 *
 * This file contains all Data Transfer Objects (DTOs) and Command Models
 * used across the application. All types are derived from database entities
 * defined in src/db/database.types.ts
 */

import type { Database, Tables, Enums } from "./db/database.types";

// ============================================================================
// Database Entity Types (Base types from database)
// ============================================================================

/**
 * Profile entity from database
 */
export type ProfileEntity = Tables<"profiles">;

/**
 * Need entity from database
 */
export type NeedEntity = Tables<"needs">;

// ============================================================================
// Enum Types (Re-exported for convenience)
// ============================================================================

export type NeedCategory = Enums<"need_category">;
export type NeedUnit = Enums<"need_unit">;
export type ShelterStatus = Enums<"shelter_status">;
export type UrgencyLevel = Enums<"urgency_level">;
export type UserRole = Enums<"user_role">;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Location coordinates (transformed from PostGIS geography type)
 * Note: Can be null for super_admin profiles
 */
export interface Location {
  lat: number;
  lon: number;
}

/**
 * Pagination metadata for list responses
 */
export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Needs summary for profile detail view
 */
export interface NeedsSummary {
  total: number;
  urgent: number;
  fulfilled: number;
}

/**
 * Shelter information embedded in Need DTOs
 */
export interface ShelterInfo {
  id: string;
  name: string;
  city: string;
}

/**
 * Extended shelter information for Need detail view
 */
export interface ShelterDetailInfo extends ShelterInfo {
  phone_number: string | null;
}

// ============================================================================
// Profile DTOs
// ============================================================================

/**
 * DTO 1: GET /api/profiles - List item for verified shelters on map
 */
export interface ProfileListItemDTO {
  id: string;
  name: string;
  city: string;
  location: Location;
  distance_km?: number; // Optional, only when user provides geolocation
  has_urgent_needs: boolean;
  needs_count: number;
  urgent_needs_count: number;
}

/**
 * DTO 2: GET /api/profiles/:id - Detailed shelter information
 */
export interface ProfileDetailDTO {
  id: string;
  name: string;
  city: string;
  address: string;
  location: Location;
  phone_number: string | null;
  website_url: string | null;
  created_at: string;
  needs_summary: NeedsSummary;
}

/**
 * DTO 3: GET /api/profiles/me - Authenticated user's own profile
 * Includes all editable and non-editable fields
 * Note: name, city, address, location are nullable for super_admin role
 */
export interface ProfileMeDTO {
  id: string;
  role: UserRole;
  status: ShelterStatus;
  name: string | null;
  nip: string | null;
  city: string | null;
  address: string | null;
  location: Location | null;
  phone_number: string | null;
  website_url: string | null;
  verification_doc_path: string | null;
  ai_usage_count: number;
  created_at: string;
  updated_at: string | null;
}

/**
 * DTO 4: PATCH /api/profiles/me - Response after profile update
 */
export interface ProfileUpdateResponseDTO {
  id: string;
  name: string | null;
  city: string | null;
  updated_at: string;
}

/**
 * DTO 5: POST /api/profiles/me/verification-document - Response after document upload
 */
export interface VerificationDocumentUploadResponseDTO {
  verification_doc_path: string;
  uploaded_at: string;
}

/**
 * DTO 6: POST /api/profiles/me/geocode - Response from geocoding service
 */
export interface GeocodeResponseDTO {
  location: Location;
  formatted_address: string;
}

/**
 * DTO 7: GET /api/admin/shelters/pending - Pending shelter list item for admin
 */
export interface PendingShelterListItemDTO {
  id: string;
  name: string | null;
  nip: string | null;
  city: string | null;
  email: string; // Note: This comes from auth.users, not profiles table
  verification_doc_path: string | null;
  created_at: string;
}

/**
 * DTO 8: PATCH /api/admin/shelters/:id/status - Response after status update
 */
export interface ShelterStatusUpdateResponseDTO {
  id: string;
  status: ShelterStatus;
  updated_at: string;
}

/**
 * DTO 9: Response wrapper for profile list endpoints
 */
export interface ProfileListResponseDTO {
  data: ProfileListItemDTO[];
  pagination: Pagination;
}

// ============================================================================
// Needs DTOs
// ============================================================================

/**
 * DTO 10: GET /api/needs - List item for needs
 * Includes embedded shelter info and calculated progress
 */
export interface NeedListItemDTO {
  id: string;
  shelter: ShelterInfo;
  category: NeedCategory;
  title: string;
  description: string | null;
  urgency: UrgencyLevel;
  target_quantity: number;
  current_quantity: number;
  unit: NeedUnit;
  progress_percentage: number;
  is_fulfilled: boolean;
  created_at: string;
}

/**
 * DTO 11: GET /api/needs/:id - Detailed need information
 * Includes extended shelter info and shopping URL
 */
export interface NeedDetailDTO {
  id: string;
  shelter: ShelterDetailInfo;
  category: NeedCategory;
  title: string;
  description: string | null;
  shopping_url: string | null;
  urgency: UrgencyLevel;
  target_quantity: number;
  current_quantity: number;
  unit: NeedUnit;
  progress_percentage: number;
  is_fulfilled: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * DTO 12: POST /api/needs - Response after creating a need
 */
export interface NeedCreateResponseDTO {
  id: string;
  shelter_id: string;
  category: NeedCategory;
  title: string;
  description: string | null;
  shopping_url: string | null;
  urgency: UrgencyLevel;
  target_quantity: number;
  current_quantity: number;
  unit: NeedUnit;
  is_fulfilled: boolean;
  created_at: string;
}

/**
 * DTO 13: PATCH /api/needs/:id - Response after updating a need
 */
export interface NeedUpdateResponseDTO {
  id: string;
  title: string;
  description: string | null;
  urgency: UrgencyLevel;
  current_quantity: number;
  progress_percentage: number;
  updated_at: string;
}

/**
 * DTO 14: DELETE /api/needs/:id - Response after soft deleting a need
 */
export interface NeedDeleteResponseDTO {
  message: string;
  deleted_at: string;
}

/**
 * DTO 15: POST /api/needs/:id/fulfill - Response after marking need as fulfilled
 */
export interface NeedFulfillResponseDTO {
  id: string;
  is_fulfilled: boolean;
  updated_at: string;
}

/**
 * DTO 16: Response wrapper for needs list endpoints
 */
export interface NeedListResponseDTO {
  data: NeedListItemDTO[];
  pagination: Pagination;
}

// ============================================================================
// AI-Powered Endpoints DTOs
// ============================================================================

/**
 * DTO 17: POST /api/ai/generate-description - Response from AI description generation
 */
export interface AIGenerateDescriptionResponseDTO {
  description: string;
  ai_usage_incremented: boolean;
}

/**
 * DTO 18: POST /api/ai/generate-shopping-link - Response from AI shopping link generation
 */
export interface AIGenerateShoppingLinkResponseDTO {
  shopping_url: string;
  ai_usage_incremented: boolean;
}

// ============================================================================
// Admin DTOs
// ============================================================================

/**
 * DTO 19: Response wrapper for pending shelters list
 */
export interface PendingShelterListResponseDTO {
  data: PendingShelterListItemDTO[];
  pagination: Pagination;
}

// ============================================================================
// Command Models (Request Bodies)
// ============================================================================

/**
 * Command 1: PATCH /api/profiles/me - Update profile request
 * Only includes fields that can be updated by the user
 */
export interface UpdateProfileCommand {
  name?: string;
  city?: string;
  address?: string;
  phone_number?: string | null;
  website_url?: string | null;
}

/**
 * Command 2: POST /api/profiles/me/geocode - Geocode address request
 */
export interface GeocodeCommand {
  address: string;
}

/**
 * Command 3: POST /api/needs - Create need request
 */
export interface CreateNeedCommand {
  category: NeedCategory;
  title: string;
  urgency: UrgencyLevel;
  target_quantity: number;
  unit: NeedUnit;
  description?: string | null;
  shopping_url?: string | null;
}

/**
 * Command 4: PATCH /api/needs/:id - Update need request
 */
export interface UpdateNeedCommand {
  title?: string;
  description?: string | null;
  shopping_url?: string | null;
  urgency?: UrgencyLevel;
  current_quantity?: number;
  target_quantity?: number;
  category?: NeedCategory;
  unit?: NeedUnit;
}

/**
 * Command 5: POST /api/ai/generate-description - Generate AI description request
 */
export interface GenerateDescriptionCommand {
  need_id: string;
  category: NeedCategory;
  title: string;
  target_quantity: number;
  unit: NeedUnit;
}

/**
 * Command 6: POST /api/ai/generate-shopping-link - Generate shopping link request
 */
export interface GenerateShoppingLinkCommand {
  need_id: string;
  title: string;
  category: NeedCategory;
}

/**
 * Command 7: PATCH /api/admin/shelters/:id/status - Update shelter status request
 */
export interface UpdateShelterStatusCommand {
  status: ShelterStatus;
  rejection_reason?: string | null;
}

// ============================================================================
// Query Parameters Types
// ============================================================================

/**
 * Query parameters for GET /api/profiles
 */
export interface ProfilesQueryParams {
  lat?: number;
  lon?: number;
  urgent_only?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Query parameters for GET /api/needs
 */
export interface NeedsQueryParams {
  shelter_id?: string;
  category?: NeedCategory;
  urgency?: UrgencyLevel;
  fulfilled?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Query parameters for GET /api/admin/shelters/pending
 */
export interface PendingSheltersQueryParams {
  limit?: number;
  offset?: number;
}

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

/**
 * Error detail for validation errors
 */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Error codes used in API responses
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_SUSPENDED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";
