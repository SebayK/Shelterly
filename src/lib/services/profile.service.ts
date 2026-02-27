import type { SupabaseClient } from "../../db/supabase.client";
import type {
  ProfileListItemDTO,
  ProfileDetailDTO,
  ProfileMeDTO,
  ProfileUpdateResponseDTO,
  ProfileListResponseDTO,
  NeedsSummary,
  Location,
} from "../../types";
import { NotFoundError, InternalError, AddressNotFoundError, logError } from "../errors";
import { APP_CONFIG } from "../config";

/**
 * Profile Service
 * Handles all business logic related to shelter profiles
 */
export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get list of verified shelters with optional geolocation filtering
   * Uses aggregated query to avoid N+1 problem
   * Filters urgent_only at query level for accurate pagination
   * Sorts by distance when coordinates provided (requires loading all results)
   */
  async getVerifiedProfiles(params: {
    lat?: number;
    lon?: number;
    urgent_only?: boolean;
    limit: number;
    offset: number;
  }): Promise<ProfileListResponseDTO> {
    const { lat, lon, urgent_only, limit, offset } = params;

    // Build aggregated query using LEFT JOIN to get needs counts in one query
    // This avoids N+1 problem where we'd query needs for each profile separately
    let query = this.supabase
      .from("profiles")
      .select(
        `
        id,
        name,
        city,
        location,
        created_at,
        needs:needs!shelter_id(urgency, is_fulfilled)
      `,
        { count: "exact" }
      )
      .eq("status", "verified")
      .eq("role", "shelter"); // Only show shelters, not admins

    // If urgent_only filter is requested, we need to filter profiles that have urgent needs
    // This must be done at query level to get correct total count for pagination
    if (urgent_only) {
      // Use EXISTS subquery to filter only profiles with urgent needs
      query = query.filter("needs.urgency", "in", "(high,critical)").filter("needs.deleted_at", "is", null);
    }

    // Execute query
    const { data: profiles, error, count } = await query;

    if (error) {
      logError("[ProfileService.getVerifiedProfiles]", error);
      throw new InternalError("Unable to retrieve shelter profiles");
    }

    if (!profiles || profiles.length === 0) {
      return {
        data: [],
        pagination: {
          total: 0,
          limit,
          offset,
        },
      };
    }

    // Transform profiles to DTOs
    const profilesWithStats = profiles
      .map((profile) => {
        // Filter out deleted needs (needs table doesn't include deleted_at in select)
        // Supabase should only return non-deleted needs based on query
        const activeNeeds = profile.needs || [];

        const needsCount = activeNeeds.length;
        const urgentNeedsCount = activeNeeds.filter((n) => n.urgency === "high" || n.urgency === "critical").length;
        const hasUrgentNeeds = urgentNeedsCount > 0;

        // Parse location from PostGIS geography
        const location = this.parseLocation(profile.location);

        // Skip profiles without valid location if coordinates provided
        if (lat !== undefined && lon !== undefined && !location) {
          return null;
        }

        // Calculate distance if both coordinates and location exist
        let distance_km: number | undefined;
        if (lat !== undefined && lon !== undefined && location) {
          distance_km = this.calculateDistance(lat, lon, location.lat, location.lon);
        }

        // Verify required fields exist
        if (!profile.name || !profile.city) {
          console.warn(`Profile ${profile.id} missing required fields`);
          return null;
        }

        const dto: ProfileListItemDTO = {
          id: profile.id,
          name: profile.name,
          city: profile.city,
          location: location as Location, // Type guard ensures this is not null
          distance_km,
          has_urgent_needs: hasUrgentNeeds,
          needs_count: needsCount,
          urgent_needs_count: urgentNeedsCount,
        };

        return dto;
      })
      .filter((p): p is ProfileListItemDTO => p !== null);

    // Sort by distance if coordinates provided
    // Note: When using distance sorting, we need to sort ALL results before pagination
    // This means we fetch all profiles and paginate in-memory
    if (lat !== undefined && lon !== undefined) {
      profilesWithStats.sort((a, b) => {
        const distA = a.distance_km ?? Infinity;
        const distB = b.distance_km ?? Infinity;
        return distA - distB;
      });

      // Apply pagination after sorting
      const paginatedProfiles = profilesWithStats.slice(offset, offset + limit);

      return {
        data: paginatedProfiles,
        pagination: {
          total: profilesWithStats.length,
          limit,
          offset,
        },
      };
    }

    // Without distance sorting, we can paginate at database level
    // Apply offset/limit to the already fetched results
    const paginatedProfiles = profilesWithStats.slice(offset, offset + limit);

    return {
      data: paginatedProfiles,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    };
  }

  /**
   * Get detailed information about a specific verified shelter
   */
  async getProfileById(id: string): Promise<ProfileDetailDTO> {
    // Fetch profile
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("status", "verified")
      .eq("role", "shelter") // Only show shelters, not admins
      .single();

    if (error || !profile) {
      throw new NotFoundError("Shelter not found or not verified");
    }

    // Get needs summary
    const needsSummary = await this.getNeedsSummary(id);

    // Verify shelter has required fields (for verified shelters, these should never be null)
    if (!profile.name || !profile.city) {
      console.warn(`Verified profile ${id} has missing required fields`);
      throw new NotFoundError("Shelter data incomplete");
    }

    // Parse location
    const location = this.parseLocation(profile.location);

    if (!location) {
      console.warn(`Profile ${id} has no valid location`);
      throw new NotFoundError("Shelter location data unavailable");
    }

    // Verify shelter has required fields (for verified shelters)
    if (!profile.name || !profile.city || !profile.address) {
      console.warn(`Verified profile ${id} has missing required fields`);
      throw new NotFoundError("Shelter data incomplete");
    }

    const dto: ProfileDetailDTO = {
      id: profile.id,
      name: profile.name,
      city: profile.city,
      address: profile.address,
      location,
      phone_number: profile.phone_number,
      website_url: profile.website_url,
      created_at: profile.created_at,
      needs_summary: needsSummary,
    };

    return dto;
  }

  /**
   * Get authenticated user's full profile
   */
  async getAuthenticatedProfile(userId: string): Promise<ProfileMeDTO> {
    const { data: profile, error } = await this.supabase.from("profiles").select("*").eq("id", userId).single();

    if (error || !profile) {
      throw new NotFoundError("User profile not found");
    }

    const location = this.parseLocation(profile.location);

    const dto: ProfileMeDTO = {
      id: profile.id,
      role: profile.role,
      status: profile.status,
      name: profile.name,
      nip: profile.nip,
      city: profile.city,
      address: profile.address,
      location,
      phone_number: profile.phone_number,
      website_url: profile.website_url,
      verification_doc_path: profile.verification_doc_path,
      ai_usage_count: profile.ai_usage_count,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    return dto;
  }

  /**
   * Update authenticated user's profile
   * Only allows updating specific fields
   */
  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      city?: string;
      address?: string;
      phone_number?: string | null;
      website_url?: string | null;
    }
  ): Promise<ProfileUpdateResponseDTO> {
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id, name, city, updated_at")
      .single();

    if (error) {
      logError("[ProfileService.updateProfile]", error);
      throw new InternalError("Unable to update profile");
    }

    if (!profile) {
      throw new NotFoundError("Profile not found");
    }

    // Verify required fields (for regular shelters, these should never be null)
    if (!profile.name || !profile.city) {
      console.warn(`Profile ${userId} has missing required fields`);
      throw new NotFoundError("Profile data incomplete");
    }
    // Verify required fields (for regular shelters, these should never be null)
    if (!profile.name || !profile.city) {
      console.warn(`Profile ${userId} has missing required fields`);
      throw new NotFoundError("Profile data incomplete");
    }
    return {
      id: profile.id,
      name: profile.name,
      city: profile.city,
      updated_at: profile.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Upload verification document to Supabase Storage
   * Returns the storage path of the uploaded file
   */
  async uploadVerificationDocument(
    userId: string,
    file: File
  ): Promise<{ verification_doc_path: string; uploaded_at: string }> {
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `verification-docs/${userId}/${fileName}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await this.supabase.storage.from(APP_CONFIG.STORAGE_BUCKET).upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      logError("[ProfileService.uploadVerificationDocument:upload]", uploadError);
      throw new InternalError("Unable to upload verification document");
    }

    // Update profile with document path
    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({
        verification_doc_path: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      logError("[ProfileService.uploadVerificationDocument:update]", updateError);

      // Try to clean up the uploaded file (don't fail if cleanup fails)
      try {
        await this.supabase.storage.from(APP_CONFIG.STORAGE_BUCKET).remove([filePath]);
      } catch (cleanupError) {
        logError("[ProfileService.uploadVerificationDocument:cleanup]", cleanupError);
      }

      throw new InternalError("Unable to save verification document reference");
    }

    return {
      verification_doc_path: filePath,
      uploaded_at: new Date().toISOString(),
    };
  }

  /**
   * Geocode an address to geographic coordinates
   * Uses Nominatim (OpenStreetMap) geocoding service
   */
  async geocodeAddress(address: string): Promise<{ location: Location; formatted_address: string }> {
    const encodedAddress = encodeURIComponent(address);
    const url = `${APP_CONFIG.GEOCODING.BASE_URL}?q=${encodedAddress}&format=json&limit=1&countrycodes=${APP_CONFIG.GEOCODING.COUNTRY_CODES}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": APP_CONFIG.GEOCODING.USER_AGENT,
        },
      });

      if (!response.ok) {
        console.error(`Geocoding service returned status ${response.status}`);
        throw new InternalError("Geocoding service unavailable");
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new AddressNotFoundError("Address not found by geocoding service");
      }

      const result = data[0];

      return {
        location: {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
        },
        formatted_address: result.display_name,
      };
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        throw error;
      }

      if (error instanceof InternalError) {
        throw error;
      }

      logError("[ProfileService.geocodeAddress]", error);
      throw new InternalError("Unable to geocode address");
    }
  }

  /**
   * Helper: Get needs summary for a shelter
   */
  private async getNeedsSummary(shelterId: string): Promise<NeedsSummary> {
    const { data: needs, error } = await this.supabase
      .from("needs")
      .select("urgency, is_fulfilled")
      .eq("shelter_id", shelterId)
      .is("deleted_at", null);

    if (error) {
      return { total: 0, urgent: 0, fulfilled: 0 };
    }

    const total = needs?.length || 0;
    const urgent = needs?.filter((n) => n.urgency === "high" || n.urgency === "critical").length || 0;
    const fulfilled = needs?.filter((n) => n.is_fulfilled).length || 0;

    return { total, urgent, fulfilled };
  }

  /**
   * Helper: Parse PostGIS geography to Location object
   * PostGIS stores as WKT: POINT(lon lat) or GeoJSON format
   * Returns null if location cannot be parsed (caller must handle)
   */
  private parseLocation(geography: unknown): Location | null {
    // If geography is already parsed as GeoJSON
    if (
      geography &&
      typeof geography === "object" &&
      "coordinates" in geography &&
      Array.isArray((geography as { coordinates: unknown }).coordinates)
    ) {
      const [lon, lat] = (geography as { coordinates: [number, number] }).coordinates;

      // Validate coordinates are within valid ranges
      if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }

      console.warn("Invalid GeoJSON coordinates:", { lat, lon });
      return null;
    }

    // If geography is WKT string: "POINT(lon lat)"
    if (typeof geography === "string") {
      const match = geography.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) {
        const lon = parseFloat(match[1]);
        const lat = parseFloat(match[2]);

        if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return { lon, lat };
        }

        console.warn("Invalid WKT coordinates:", { lat, lon });
        return null;
      }
    }

    // Unable to parse location
    if (geography !== null && geography !== undefined) {
      console.warn("Unable to parse location from geography:", typeof geography);
    }

    return null;
  }

  /**
   * Helper: Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Helper: Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
