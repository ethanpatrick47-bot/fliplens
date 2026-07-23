type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  scope: "ip" | "global";
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ipBuckets = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, resetAt: Date.now() + DAY_MS };

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function clientAddress(request: Request) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realAddress = request.headers.get("x-real-ip")?.trim();
  return (cloudflareAddress || forwardedAddress || realAddress || "unknown").slice(0, 80);
}

function consume(bucket: Bucket, now: number, windowMs: number, limit: number): RateLimitDecision {
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      scope: "ip",
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: 0,
    scope: "ip",
  };
}

export function checkAnalysisRateLimit(request: Request): RateLimitDecision {
  const now = Date.now();
  const globalLimit = positiveInteger("FLIPLENS_GLOBAL_DAILY_LIMIT", 100);
  const perIpLimit = positiveInteger("FLIPLENS_PER_IP_HOURLY_LIMIT", 10);

  const globalDecision = consume(globalBucket, now, DAY_MS, globalLimit);
  if (!globalDecision.allowed) return { ...globalDecision, scope: "global" };

  const address = clientAddress(request);
  const bucket = ipBuckets.get(address) || { count: 0, resetAt: now + HOUR_MS };
  ipBuckets.set(address, bucket);
  const ipDecision = consume(bucket, now, HOUR_MS, perIpLimit);

  if (!ipDecision.allowed) {
    globalBucket.count = Math.max(0, globalBucket.count - 1);
  }

  if (ipBuckets.size > 5_000) {
    for (const [key, value] of ipBuckets) {
      if (value.resetAt <= now) ipBuckets.delete(key);
    }
  }

  return ipDecision;
}

export function rateLimitHeaders(decision: RateLimitDecision) {
  return {
    "Cache-Control": "no-store",
    "Retry-After": String(decision.retryAfterSeconds),
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Scope": decision.scope,
  };
}
