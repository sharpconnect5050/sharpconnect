import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

const LIMITS = {
  campaign: { max: 5, window: FIVE_MINUTES },
  track: { max: 30, window: ONE_MINUTE },
  payment: { max: 10, window: FIVE_MINUTES },
  review: { max: 20, window: ONE_MINUTE },
  telegram: { max: 15, window: ONE_MINUTE },
  events: { max: 30, window: ONE_MINUTE },
  ai: { max: 20, window: ONE_MINUTE },
  default: { max: 60, window: ONE_MINUTE },
} as const;

export type RateLimitScope = keyof typeof LIMITS;

function getIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

export function checkRateLimit(
  request: NextRequest,
  scope: RateLimitScope = "default"
): NextResponse | null {
  const cfg = LIMITS[scope] || LIMITS.default;
  const ip = getIp(request);
  const key = `${scope}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + cfg.window };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > cfg.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(cfg.max),
          "X-RateLimit-Reset": String(entry.resetAt),
        },
      }
    );
  }

  return null;
}

export function clearRateLimits(): void {
  store.clear();
}

if (typeof global !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}
