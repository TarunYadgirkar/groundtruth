import { z } from "zod";
import { clientIp, rateLimiter, sameOrigin } from "@/lib/api-guard";
import type { PlaceLookup } from "@/lib/place";

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const TIMEOUT_MS = 6000;
const CACHE_MAX = 2000;
const rateLimited = rateLimiter({ windowMs: 60_000, perIp: 30, global: 600 });
const cache = new Map<string, PlaceLookup>();

const Query = z.object({
  lat: z.coerce.number().min(18).max(72),
  lng: z.coerce.number().min(-180).max(-60),
});

const Geography = z.object({ BASENAME: z.string(), NAME: z.string(), LSADC: z.string().optional(), FUNCSTAT: z.string().optional() });
const CensusResponse = z.object({
  result: z.object({
    geographies: z.object({
      "Incorporated Places": z.array(Geography).optional(),
      "County Subdivisions": z.array(Geography).optional(),
      Counties: z.array(Geography).optional(),
    }),
  }),
});

const CCD_LSADC = "22";

function toPlace(geo: z.infer<typeof CensusResponse>["result"]["geographies"]): PlaceLookup {
  const county = geo.Counties?.[0]?.NAME ?? null;
  const place = geo["Incorporated Places"]?.[0];
  if (place) return { city: place.BASENAME, censusName: place.NAME, kind: "incorporated", county };
  // NJ and MA townships and towns are county subdivisions, not Census places. CA's are statistical (CCDs).
  const mcd = geo["County Subdivisions"]?.find((g) => g.LSADC !== CCD_LSADC && g.FUNCSTAT !== "S");
  if (mcd) return { city: mcd.BASENAME, censusName: mcd.NAME, kind: "municipality", county };
  return { city: null, censusName: null, kind: "unincorporated", county };
}

export async function GET(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Requests must come from this site." }, { status: 403 });
  if (rateLimited(clientIp(request))) return Response.json({ error: "Too many lookups in a minute. Wait a moment and try again." }, { status: 429 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) return Response.json({ error: "Send lat and lng for a US location." }, { status: 400 });

  const { lat, lng } = parsed.data;
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return Response.json(hit);

  const url = new URL(CENSUS_URL);
  url.search = new URLSearchParams({
    x: lng.toFixed(6),
    y: lat.toFixed(6),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "Incorporated Places,County Subdivisions,Counties",
    format: "json",
  }).toString();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`census ${res.status}`);
    const body = CensusResponse.parse(await res.json());
    const place = toPlace(body.result.geographies);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, place);
    return Response.json(place);
  } catch (err) {
    console.error("census place lookup failed", err);
    return Response.json({ error: "The Census boundary service didn't answer." }, { status: 502 });
  }
}
