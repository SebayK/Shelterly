/**
 * Application configuration constants
 */

export const APP_CONFIG = {
  /**
   * Storage bucket name for verification documents
   */
  STORAGE_BUCKET: "verification-documents",

  /**
   * Geocoding service configuration
   */
  GEOCODING: {
    /**
     * Country codes for geocoding (ISO 3166-1 alpha-2)
     * For Poland-focused app, restrict to Poland for better results
     */
    COUNTRY_CODES: "pl",

    /**
     * User-Agent header for Nominatim API
     * Must include contact information per Nominatim usage policy
     */
    USER_AGENT: "Shelterly/1.0 (contact@shelterly.pl)",

    /**
     * Base URL for geocoding service (Nominatim OSM)
     */
    BASE_URL: "https://nominatim.openstreetmap.org/search",
  },

  /**
   * Default/fallback location (Warsaw, Poland)
   * Used when location parsing fails
   */
  DEFAULT_LOCATION: {
    lat: 52.2297,
    lon: 21.0122,
    name: "Warsaw, Poland",
  },
} as const;
