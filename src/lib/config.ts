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

  /**
   * Rate limiting configuration for write endpoints
   */
  RATE_LIMITING: {
    /**
     * POST /api/needs — max 20 needs per shelter per 15 minutes
     */
    CREATE_NEED: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20,
    },
  },

  /**
   * AI integrations configuration
   */
  AI: {
    /** Maximum number of AI generations per shelter */
    USAGE_LIMIT: 100,

    /** OpenRouter model used for need description generation */
    DESCRIPTION_MODEL: "openai/gpt-4o-mini",

    /** Timeout for OpenRouter calls */
    TIMEOUT_MS: 15_000,

    /** Rate limiting configuration for AI endpoints */
    RATE_LIMITING: {
      GENERATE_DESCRIPTION: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
      },
    },

    /** Default OpenRouter base URL */
    OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  },
} as const;
