/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per key (e.g. user ID or IP address).
 * Suitable for single-instance SSR deployments. For multi-instance
 * deployments, replace the store with a shared cache (e.g. Redis via Upstash).
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 });
 *   const result = limiter.check("user-uuid");
 *   if (!result.allowed) return 429;
 */

export interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed per window */
  maxRequests: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the oldest request in the window expires */
  resetAt: number;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  /** Map of key → sorted array of request timestamps */
  private readonly store = new Map<string, number[]>();
  /**
   * Background timer that evicts keys whose window has fully expired.
   * Prevents unbounded memory growth when unique keys accumulate over time.
   */
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.cleanupInterval = setInterval(() => this.prune(), this.windowMs);
  }

  /**
   * Check and record a request for the given key.
   * Slides the window and returns whether the request is allowed.
   *
   * @param key - Unique identifier for the caller (e.g. user_id or IP)
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Retrieve existing timestamps, drop those outside the window
    const timestamps = (this.store.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      // Request denied — oldest timestamp tells us when a slot frees up
      const resetAt = timestamps[0] + this.windowMs;
      return { allowed: false, remaining: 0, resetAt };
    }

    // Allow: record this request
    timestamps.push(now);
    this.store.set(key, timestamps);

    const remaining = this.maxRequests - timestamps.length;
    const resetAt = timestamps[0] + this.windowMs;

    return { allowed: true, remaining, resetAt };
  }

  /**
   * Remove all recorded data for a key.
   * Useful in tests or when a user session ends.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Evict all keys whose entire request window has expired.
   * Called automatically every windowMs by the internal cleanup interval.
   */
  private prune(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, timestamps] of this.store.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, active);
      }
    }
  }

  /**
   * Stop the background cleanup interval.
   * Call this when the limiter instance is no longer needed (e.g., in tests).
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
