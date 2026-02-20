import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;
  const KEY = "shelter-uuid-123";

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Allowed requests
  // -------------------------------------------------------------------------

  it("allows the first request", () => {
    const result = limiter.check(KEY);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("allows requests up to the limit", () => {
    limiter.check(KEY); // 1
    limiter.check(KEY); // 2
    const result = limiter.check(KEY); // 3 — last allowed
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns correct remaining count after each request", () => {
    expect(limiter.check(KEY).remaining).toBe(2);
    expect(limiter.check(KEY).remaining).toBe(1);
    expect(limiter.check(KEY).remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    limiter.check(KEY);
    limiter.check(KEY);
    limiter.check(KEY); // KEY exhausted

    const other = limiter.check("other-shelter-uuid");
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Denied requests
  // -------------------------------------------------------------------------

  it("denies request when limit is exceeded", () => {
    limiter.check(KEY);
    limiter.check(KEY);
    limiter.check(KEY); // fills the bucket
    const result = limiter.check(KEY); // over limit
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns a resetAt timestamp in the future when denied", () => {
    const now = Date.now();
    limiter.check(KEY);
    limiter.check(KEY);
    limiter.check(KEY);
    const { resetAt } = limiter.check(KEY);
    expect(resetAt).toBeGreaterThan(now);
  });

  // -------------------------------------------------------------------------
  // Sliding window — slots reopen after windowMs
  // -------------------------------------------------------------------------

  it("allows requests again after the window expires", () => {
    limiter.check(KEY);
    limiter.check(KEY);
    limiter.check(KEY); // exhausted

    // Advance time past the full window
    vi.advanceTimersByTime(60_001);

    const result = limiter.check(KEY);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("slides the window — only expired slots are freed", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    limiter.check(KEY); // t=0

    vi.advanceTimersByTime(30_000); // t=30s
    limiter.check(KEY); // t=30s
    limiter.check(KEY); // t=30s — exhausted

    // Advance to t=61s — first request (t=0) expires, one slot reopens
    vi.advanceTimersByTime(31_000);
    const result = limiter.check(KEY);
    expect(result.allowed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // reset()
  // -------------------------------------------------------------------------

  it("reset() clears all timestamps for the key", () => {
    limiter.check(KEY);
    limiter.check(KEY);
    limiter.check(KEY); // exhausted

    limiter.reset(KEY);

    const result = limiter.check(KEY);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("reset() does not affect other keys", () => {
    limiter.check(KEY);
    limiter.check(KEY);
    limiter.check(KEY); // KEY exhausted
    limiter.check("other"); // other has 2 remaining

    limiter.reset(KEY);

    expect(limiter.check("other").remaining).toBe(1);
  });
});
