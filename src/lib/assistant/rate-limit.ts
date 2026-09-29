/**
 * Per-key sliding-window limiter for Ask Prodwise (decision D7).
 *
 * In-memory and per process: on a serverless host each instance counts on its
 * own, so the effective limit is "per user per instance" — a best-effort
 * spend bound, not a security control. A shared counter table is the hosted
 * follow-up; the interface stays the same. Keys are opaque user ids; nothing
 * about the question is kept.
 */
export interface RateDecision { allowed: boolean; remaining: number; retryAfterMs: number }
export interface RateRule { limit: number; windowMs: number }
export const MEMBER_RULE: RateRule = { limit: 20, windowMs: 10 * 60_000 };
export const GUEST_RULE: RateRule = { limit: 10, windowMs: 10 * 60_000 };

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly now: () => number = Date.now) {}
  /** Consumes one unit when allowed. Denials consume nothing and report when the oldest hit expires. */
  take(key: string, rule: RateRule): RateDecision {
    const at = this.now(), floor = at - rule.windowMs;
    this.sweep(floor);
    const recent = (this.hits.get(key) ?? []).filter(t => t > floor);
    if (recent.length >= rule.limit) { this.hits.set(key, recent); return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, recent[0]! + rule.windowMs - at) }; }
    recent.push(at); this.hits.set(key, recent);
    return { allowed: true, remaining: rule.limit - recent.length, retryAfterMs: 0 };
  }
  /** Keeps the map small: forget keys whose every hit has expired. Runs at most every ~250 takes. */
  private takes = 0;
  private sweep(floor: number) { if (++this.takes % 250) return; for (const [k, v] of this.hits) if (!v.some(t => t > floor)) this.hits.delete(k); }
  size() { return this.hits.size; }
}
