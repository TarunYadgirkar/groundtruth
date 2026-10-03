import { RULES } from "./data";
import type { Address } from "./types";

export interface PlaceLookup {
  city: string | null;
  censusName: string | null;
  kind: "incorporated" | "municipality" | "unincorporated";
  county: string | null;
}

const PLACE_TIMEOUT_MS = 7000;
const NORMALIZE_TIMEOUT_MS = 8000;

export const COVERED_CITIES: { city: string; state: Address["state"] }[] = [
  ...new Set(RULES.filter((r) => r.level === "city").map((r) => r.jurisdiction)),
]
  .sort()
  .map((j) => {
    const [city, state] = j.split(", ");
    return { city, state: state as Address["state"] };
  });

export function isCoveredCity(city: string | null, state: Address["state"]): boolean {
  return !!city && COVERED_CITIES.some((c) => c.city === city && c.state === state);
}

export async function lookupPlace(lat: number, lng: number): Promise<PlaceLookup | null> {
  try {
    const res = await fetch(`/api/place?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { signal: AbortSignal.timeout(PLACE_TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as PlaceLookup;
  } catch {
    return null;
  }
}

export async function normalizeQuery(query: string): Promise<string | null> {
  try {
    const res = await fetch("/api/normalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(NORMALIZE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { address } = (await res.json()) as { address: string | null };
    return address;
  } catch {
    return null;
  }
}
