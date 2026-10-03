export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const hops = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  return hops.at(-1)?.trim() || "local";
}

export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

interface Limits {
  windowMs: number;
  perIp: number;
  global: number;
}

// In-memory sliding window per server instance. Good enough to stop a runaway client.
export function rateLimiter({ windowMs, perIp, global }: Limits): (ip: string) => boolean {
  const hits = new Map<string, number[]>();
  let globalHits: number[] = [];
  return (ip) => {
    const now = Date.now();
    globalHits = globalHits.filter((t) => now - t < windowMs);
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(key);
    }
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    hits.set(ip, [...recent, now]);
    globalHits = [...globalHits, now];
    return recent.length >= perIp || globalHits.length > global;
  };
}
