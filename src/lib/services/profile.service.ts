import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type {
  ProfileListItemDTO,
  ProfileDetailDTO,
  ProfileMeDTO,
  ProfileUpdateResponseDTO,
  ProfileListResponseDTO,
  Location,
} from "../../types";
import {
  NotFoundError,
  InternalError,
  ValidationError,
  AddressNotFoundError,
  logError,
  logErrorWithContext,
  logWarningWithContext,
} from "../errors";
import { APP_CONFIG } from "../config";

const VERIFICATION_DOCUMENT_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
} as const;

// EWKB (hex) length constants (hex chars). Calculations:
// - byte-order (1) + geometry type (4) + coordinates (2 * 8) = 1+4+16 = 21 bytes => 42 hex chars
// - with SRID present add 4 bytes => 25 bytes => 50 hex chars
const EWKB_MIN_HEX_LENGTH_NO_SRID = 42;

type PublicVerifiedProfileRow = Database["public"]["Functions"]["get_public_verified_profiles"]["Returns"][number];
type PublicVerifiedProfileDetailRow =
  Database["public"]["Functions"]["get_public_verified_profile_detail"]["Returns"][number];

/**
 * Profile Service
 * Handles all business logic related to shelter profiles
 */
export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get list of verified shelters with optional geolocation filtering
   * Uses a SECURITY DEFINER RPC that exposes only safe public fields.
   */
  async getVerifiedProfiles(params: {
    lat?: number;
    lon?: number;
    urgent_only?: boolean;
    limit: number;
    offset: number;
  }): Promise<ProfileListResponseDTO> {
    const { lat, lon, urgent_only, limit, offset } = params;
    const { data: profiles, error } = await this.supabase.rpc("get_public_verified_profiles", {
      p_limit: limit,
      p_offset: offset,
      p_lat: lat ?? null,
      p_lon: lon ?? null,
      p_urgent_only: urgent_only ?? false,
    });

    if (error) {
      logError("[ProfileService.getVerifiedProfiles]", error);
      throw new InternalError("Unable to retrieve shelter profiles");
    }

    if (!profiles || profiles.length === 0) {
      return {
        data: [],
        pagination: {
          total: await this.getVerifiedProfilesTotal({
            lat,
            lon,
            urgent_only,
          }),
          limit,
          offset,
        },
      };
    }

    const profilesWithStats = profiles
      .map((profile: PublicVerifiedProfileRow) => {
        const location = this.parseLocation(profile.location);

        if (!location) {
          logWarningWithContext(
            { endpoint: "ProfileService.getVerifiedProfiles", shelter_id: profile.id },
            "Skipping verified profile without valid location"
          );
          return null;
        }

        if (!profile.name || !profile.city) {
          logWarningWithContext(
            { endpoint: "ProfileService.getVerifiedProfiles", shelter_id: profile.id },
            "Profile missing required fields"
          );
          return null;
        }

        const dto: ProfileListItemDTO = {
          id: profile.id,
          name: profile.name,
          city: profile.city,
          location,
          distance_km: this.toKilometers(profile.distance_meters),
          has_urgent_needs: profile.urgent_needs_count > 0,
          needs_count: profile.needs_count,
          urgent_needs_count: profile.urgent_needs_count,
        };

        return dto;
      })
      .filter((p): p is ProfileListItemDTO => p !== null);
    const total = Number(profiles[0]?.total_count ?? 0);

    return {
      data: profilesWithStats,
      pagination: {
        total,
        limit,
        offset,
      },
    };
  }

  private async getVerifiedProfilesTotal(params: {
    lat?: number;
    lon?: number;
    urgent_only?: boolean;
  }): Promise<number> {
    const { data, error } = await this.supabase.rpc("get_public_verified_profiles", {
      p_limit: 1,
      p_offset: 0,
      p_lat: params.lat ?? null,
      p_lon: params.lon ?? null,
      p_urgent_only: params.urgent_only ?? false,
    });

    if (error) {
      logError("[ProfileService.getVerifiedProfilesTotal]", error);
      throw new InternalError("Unable to retrieve shelter profiles");
    }

    return Number(data?.[0]?.total_count ?? 0);
  }

  /**
   * Get detailed information about a specific verified shelter
   */
  async getProfileById(id: string): Promise<ProfileDetailDTO> {
    const { data, error } = await this.supabase.rpc("get_public_verified_profile_detail", {
      p_profile_id: id,
    });

    if (error) {
      logError("[ProfileService.getProfileById]", error);
      throw new InternalError("Unable to retrieve shelter profile");
    }

    const profile = data?.[0] as PublicVerifiedProfileDetailRow | undefined;

    if (!profile) {
      throw new NotFoundError("Shelter not found or not verified");
    }

    // Verify shelter has required fields (for verified shelters, these should never be null)
    if (!profile.name || !profile.city) {
      logWarningWithContext(
        { endpoint: "ProfileService.getProfileById", shelter_id: id },
        "Verified profile has missing required fields"
      );
      throw new NotFoundError("Shelter data incomplete");
    }

    // Parse location
    const location = this.parseLocation(profile.location);

    if (!location) {
      logWarningWithContext(
        { endpoint: "ProfileService.getProfileById", shelter_id: id },
        "Profile has no valid location"
      );
      throw new NotFoundError("Shelter location data unavailable");
    }

    // Verify shelter has required fields (for verified shelters)
    if (!profile.name || !profile.city || !profile.address) {
      logWarningWithContext(
        { endpoint: "ProfileService.getProfileById", shelter_id: id },
        "Verified profile has missing required fields"
      );
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
      needs_summary: {
        total: profile.needs_total,
        urgent: profile.needs_urgent,
        fulfilled: profile.needs_fulfilled,
      },
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
      rejection_reason: profile.rejection_reason,
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
      location?: Location | null;
      phone_number?: string | null;
      website_url?: string | null;
    }
  ): Promise<ProfileUpdateResponseDTO> {
    const profileUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) profileUpdates.name = updates.name;
    if (updates.city !== undefined) profileUpdates.city = updates.city;
    if (updates.address !== undefined) profileUpdates.address = updates.address;
    if (updates.phone_number !== undefined) profileUpdates.phone_number = updates.phone_number;
    if (updates.website_url !== undefined) profileUpdates.website_url = updates.website_url;
    if (updates.location !== undefined) {
      profileUpdates.location = updates.location ? this.serializeLocation(updates.location) : null;
    }

    const { data: profile, error } = await this.supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId)
      .select("id, name, city, location, updated_at")
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
      logWarningWithContext(
        { endpoint: "ProfileService.updateProfile", user_id: userId },
        "Profile has missing required fields"
      );
      throw new NotFoundError("Profile data incomplete");
    }

    const location = this.parseLocation(profile.location);

    return {
      id: profile.id,
      name: profile.name,
      city: profile.city,
      location,
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
    const extension = this.getVerificationDocumentExtension(file.type);
    const sanitizedBaseName = this.sanitizeFileBaseName(file.name);
    const fileName = `${timestamp}-${sanitizedBaseName}.${extension}`;
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
    const queries = this.buildGeocodingQueries(address);

    try {
      for (const query of queries) {
        const encodedAddress = encodeURIComponent(query);
        const url = `${APP_CONFIG.GEOCODING.BASE_URL}?q=${encodedAddress}&format=jsonv2&limit=1&countrycodes=${APP_CONFIG.GEOCODING.COUNTRY_CODES}`;

        const response = await fetch(url, {
          headers: {
            "User-Agent": APP_CONFIG.GEOCODING.USER_AGENT,
          },
        });

        if (!response.ok) {
          logErrorWithContext(
            { endpoint: "ProfileService.geocodeAddress", request_body: { geocode_query: query } },
            new Error(`Geocoding service returned status ${response.status}`)
          );
          throw new InternalError("Geocoding service unavailable");
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          continue;
        }

        const result = data[0];

        return {
          location: {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
          },
          formatted_address: result.display_name,
        };
      }

      throw new AddressNotFoundError("Address not found by geocoding service");
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
   * Build a prioritized list of address query variants for the geocoding service.
   * The list is de-duplicated but preserves order of preference:
   *  1. The original normalized address.
   *  2. Address with common Polish street prefixes removed (shorter fallback).
   *  3. The original address with an explicit ", Polska" suffix to hint country.
   *  4. The shortened address with ", Polska" suffix.
   *
   * Rationale: Nominatim/OpenStreetMap sometimes resolves better with or without
   * street-type prefixes (e.g. "ul.") or when the country is explicit. The
   * service will attempt variants in this order until a result is found.
   */
  private buildGeocodingQueries(address: string): string[] {
    const normalizedAddress = address.trim().replace(/\s+/g, " ");
    const withoutStreetPrefix = normalizedAddress.replace(/^(ul\.?|al\.?|aleja|pl\.?|plac|os\.?|osiedle)\s+/i, "");
    const withCountry = `${withoutStreetPrefix}, Polska`;

    return Array.from(
      new Set([normalizedAddress, withoutStreetPrefix, `${normalizedAddress}, Polska`, withCountry].filter(Boolean))
    );
  }

  /**
   * Serialize a `Location` object into PostGIS WKT `POINT(lon lat)` format.
   *
   * Note: PostGIS WKT uses the coordinate order `X Y` which for geographic
   * coordinates corresponds to `lon lat` (longitude then latitude). This method
   * returns the WKT string (without SRID); callers may store it in PostGIS
   * geography/geometry columns which may include SRID metadata separately.
   */
  private serializeLocation(location: Location): string {
    return `POINT(${location.lon} ${location.lat})`;
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

      logWarningWithContext({ endpoint: "ProfileService.parseLocation" }, "Invalid GeoJSON coordinates", { lat, lon });
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

        logWarningWithContext({ endpoint: "ProfileService.parseLocation" }, "Invalid WKT coordinates", { lat, lon });
        return null;
      }

      const ewkbLocation = this.parseEwkbPoint(geography);
      if (ewkbLocation) {
        return ewkbLocation;
      }
    }

    // Unable to parse location
    if (geography !== null && geography !== undefined) {
      logWarningWithContext({ endpoint: "ProfileService.parseLocation" }, "Unable to parse location from geography", {
        type: typeof geography,
      });
    }

    return null;
  }

  /**
   * Parse a PostGIS EWKB (Extended WKB) hex string for a POINT geometry.
   *
   * Implementation notes:
   * - EWKB layout: 1 byte byte-order flag (1 = little-endian, 0 = big-endian),
   *   followed by a 4-byte unsigned integer for the geometry type (EWKB may set
   *   the SRID-present flag 0x20000000), optional 4-byte SRID, then the
   *   coordinate values (double-precision floats).
   * - We accept POINT only (base geometry type code = 1). If the SRID flag is
   *   present, the SRID is skipped but not validated here (Supabase typically
   *   returns SRID 4326 for geography(Point,4326)).
   * - Coordinate byte order follows the initial byte-order flag; coordinates
   *   are read as two consecutive 64-bit floats: X then Y (i.e. lon then lat).
   *
   * Returns a `Location` with numeric `lat` and `lon` or `null` if parsing fails
   * or values are out of valid geographic ranges.
   */
  private parseEwkbPoint(hex: string): Location | null {
    // Basic sanity checks: must be hex, even length, and at least the minimum
    // size for a POINT without SRID (42 hex chars). We validate exact byte
    // lengths later after reading the geometry header (SRID flag).
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length < EWKB_MIN_HEX_LENGTH_NO_SRID || hex.length % 2 !== 0) {
      return null;
    }

    try {
      const bytes = Buffer.from(hex, "hex");
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const littleEndian = view.getUint8(0) === 1;
      const geometryType = view.getUint32(1, littleEndian);
      const hasSrid = (geometryType & 0x20000000) !== 0;
      const baseGeometryType = geometryType & 0x0fffffff;

      if (baseGeometryType !== 1) {
        return null;
      }

      let offset = 5;
      if (hasSrid) {
        offset += 4;
      }

      if (bytes.byteLength < offset + 16) {
        return null;
      }

      const lon = view.getFloat64(offset, littleEndian);
      const lat = view.getFloat64(offset + 8, littleEndian);

      if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }

      return null;
    } catch {
      return null;
    }
  }

  private toKilometers(distanceMeters: number | null): number | undefined {
    if (distanceMeters === null) {
      return undefined;
    }

    return Math.round((distanceMeters / 1000) * 100) / 100;
  }

  private sanitizeFileBaseName(fileName: string): string {
    const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "");

    return (
      nameWithoutExtension
        .replace(/[łŁ]/g, (char) => (char === "ł" ? "l" : "L"))
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "verification-document"
    );
  }

  private getVerificationDocumentExtension(fileType: string): string {
    const extension = VERIFICATION_DOCUMENT_EXTENSIONS[fileType as keyof typeof VERIFICATION_DOCUMENT_EXTENSIONS];

    if (extension) {
      return extension;
    }

    throw new ValidationError("File must be PDF, JPEG, or PNG");
  }
}
