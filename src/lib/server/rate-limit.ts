import "server-only";
import { ApiError } from "./firebase-admin";

// A per-process backstop, not a substitute for host-level rate limits/WAF.
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(request: Request, group: string, max = 30) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100) ?? "local";
  const key = `${group}:${ip}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.until <= now) { buckets.set(key, { count: 1, until: now + 60000 }); return; }
  if (bucket.count++ >= max) throw new ApiError(429, "Слишком много запросов. Повторите через минуту.");
}
