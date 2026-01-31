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

/**
 * Profile Service
 * Handles all business logic related to shelter profiles
 */
export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get list of verified shelters with optional geolocation filtering
   * Implements PostGIS distance calculation when coordinates are provided
   */
  async getVerifiedProfiles(params: {
    lat?: number;
    lon?: number;
    urgent_only?: boolean;
    limit: number;
    offset: number;
  }): Promise<ProfileListResponseDTO> {
    const { lat, lon, urgent_only, limit, offset } = params;

    // Start building the query
    const query = this.supabase.from("profiles").select("*", { count: "exact" }).eq("status", "verified");

    // If coordinates are provided, calculate distance using PostGIS
    // Note: Supabase client doesn't support ST_Distance directly,
    // so we'll use RPC function for distance calculation
    if (lat !== undefined && lon !== undefined) {
      // We'll need to create an RPC function in Supabase for this
      // For now, we'll fetch all and sort in application
      // TODO: Create PostgreSQL function for efficient distance calculation
    }

    // Execute query
    const {
      data: profiles,
      error,
      count,
    } = await query.range(offset, offset + limit - 1).order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    if (!profiles) {
      return {
        data: [],
        pagination: {
          total: 0,
          limit,
          offset,
        },
      };
    }

    // For each profile, get needs statistics
    const profilesWithNeeds = await Promise.all(
      profiles.map(async (profile) => {
        const { data: needs, error: needsError } = await this.supabase
          .from("needs")
          .select("urgency, is_fulfilled")
          .eq("shelter_id", profile.id)
          .is("deleted_at", null);

        if (needsError) {
          // Continue with zero counts rather than failing
        }

        const needsCount = needs?.length || 0;
        const urgentNeedsCount = needs?.filter((n) => n.urgency === "high" || n.urgency === "critical").length || 0;
        const hasUrgentNeeds = urgentNeedsCount > 0;

        // Parse location from PostGIS geography
        // PostGIS stores as POINT(lon lat), we need to parse it
        const location = this.parseLocation(profile.location);

        // Calculate distance if coordinates provided
        let distance_km: number | undefined;
        if (lat !== undefined && lon !== undefined && location) {
          distance_km = this.calculateDistance(lat, lon, location.lat, location.lon);
        }

        const dto: ProfileListItemDTO = {
          id: profile.id,
          name: profile.name,
          city: profile.city,
          location,
          distance_km,
          has_urgent_needs: hasUrgentNeeds,
          needs_count: needsCount,
          urgent_needs_count: urgentNeedsCount,
        };

        return dto;
      })
    );

    // Filter by urgent_only if requested
    const filteredProfiles = urgent_only ? profilesWithNeeds.filter((p) => p.has_urgent_needs) : profilesWithNeeds;

    // Sort by distance if coordinates provided
    if (lat !== undefined && lon !== undefined) {
      filteredProfiles.sort((a, b) => {
        const distA = a.distance_km ?? Infinity;
        const distB = b.distance_km ?? Infinity;
        return distA - distB;
      });
    }

    return {
      data: filteredProfiles,
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
      .single();

    if (error || !profile) {
      throw new Error("NOT_FOUND");
    }

    // Get needs summary
    const needsSummary = await this.getNeedsSummary(id);

    // Parse location
    const location = this.parseLocation(profile.location);

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
      throw new Error("NOT_FOUND");
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

    if (error || !profile) {
      throw new Error(`Failed to update profile: ${error?.message || "Unknown error"}`);
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
    const { error: uploadError } = await this.supabase.storage.from("verification-documents").upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
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
      // Try to clean up the uploaded file
      await this.supabase.storage.from("verification-documents").remove([filePath]);
      throw new Error(`Failed to update profile with document path: ${updateError.message}`);
    }

    return {
      verification_doc_path: filePath,
      uploaded_at: new Date().toISOString(),
    };
  }

  /**
   * Geocode an address to geographic coordinates
   * Uses external geocoding service (e.g., Nominatim, Google Maps, etc.)
   */
  async geocodeAddress(address: string): Promise<{ location: Location; formatted_address: string }> {
    // Using Nominatim (OpenStreetMap) as free geocoding service
    // In production, consider using Google Maps API or other paid service for better accuracy
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=pl`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Shelterly/1.0", // Nominatim requires a User-Agent
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding service returned status ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("ADDRESS_NOT_FOUND");
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
      if (error instanceof Error && error.message === "ADDRESS_NOT_FOUND") {
        throw error;
      }
      throw new Error(`Geocoding failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
   * PostGIS stores as WKT: POINT(lon lat)
   */
  private parseLocation(geography: unknown): Location {
    // If geography is already parsed as GeoJSON
    if (
      geography &&
      typeof geography === "object" &&
      "coordinates" in geography &&
      Array.isArray((geography as { coordinates: unknown }).coordinates)
    ) {
      const [lon, lat] = (geography as { coordinates: [number, number] }).coordinates;
      return { lat, lon };
    }

    // If geography is WKT string: "POINT(lon lat)"
    if (typeof geography === "string") {
      const match = geography.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) {
        return {
          lon: parseFloat(match[1]),
          lat: parseFloat(match[2]),
        };
      }
    }

    // Fallback to default location (Warsaw, Poland)
    return { lat: 52.2297, lon: 21.0122 };
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
