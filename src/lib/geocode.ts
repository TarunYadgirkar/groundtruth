import type { Address } from "./types";

const SUPPORTED = new Set(["CA", "NJ", "MA"]);
const TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

export type Precision = "address" | "street" | "city" | "region";

export type GeocodeOutcome =
  | { ok: true; address: Address; precision: Precision; partial: boolean }
  | { ok: false; kind: "not_found" | "region" | "out_of_scope"; reason: string; place?: OutOfScopePlace };

export interface OutOfScopePlace {
  city: string;
  state: string;
  county: string | null;
}

const NOT_FOUND = "We couldn't find that address. Check the spelling, or include the city and state.";

function component(result: google.maps.GeocoderResult, type: string, short = false): string | null {
  const c = result.address_components.find((x) => x.types.includes(type));
  if (!c) return null;
  return short ? c.short_name : c.long_name;
}

function precisionOf(r: google.maps.GeocoderResult): Precision {
  const has = (...types: string[]) => types.some((t) => r.types.includes(t));
  if (has("street_address", "premise", "subpremise")) return "address";
  if (has("route", "intersection")) return "street";
  if (has("locality", "sublocality", "neighborhood", "postal_code", "administrative_area_level_3")) return "city";
  return "region";
}

const RANK: Record<Precision, number> = { address: 3, street: 2, city: 1, region: 0 };

export function isBetter(next: GeocodeOutcome, current: GeocodeOutcome): boolean {
  if (!next.ok) return false;
  if (!current.ok) return true;
  const a = RANK[next.precision] * 2 + (next.partial ? 0 : 1);
  const b = RANK[current.precision] * 2 + (current.partial ? 0 : 1);
  return a > b;
}

function headline(r: google.maps.GeocoderResult, precision: Precision, city: string | null): string {
  const street = [component(r, "street_number"), component(r, "route", true)].filter(Boolean).join(" ");
  if (precision === "address" && street) return street;
  if (precision === "city") return city ?? r.formatted_address.split(",")[0];
  return r.formatted_address.split(",")[0];
}

export async function geocodeFreeText(geocoder: google.maps.Geocoder, query: string): Promise<GeocodeOutcome> {
  let results: google.maps.GeocoderResult[];
  try {
    ({ results } = await withTimeout(geocoder.geocode({ address: query, componentRestrictions: { country: "US" } })));
  } catch {
    return { ok: false, kind: "not_found", reason: NOT_FOUND };
  }
  const top = results[0];
  if (!top) return { ok: false, kind: "not_found", reason: NOT_FOUND };
  const state = component(top, "administrative_area_level_1", true);
  if (!state) return { ok: false, kind: "not_found", reason: NOT_FOUND };
  if (!SUPPORTED.has(state)) {
    const name = component(top, "administrative_area_level_1") ?? "another state";
    const city = component(top, "locality") ?? component(top, "administrative_area_level_3");
    return {
      ok: false,
      kind: "out_of_scope",
      reason: `That address is in ${name}. Groundtruth covers California, New Jersey and Massachusetts.`,
      place: city ? { city, state, county: component(top, "administrative_area_level_2") } : undefined,
    };
  }
  const precision = precisionOf(top);
  if (precision === "region") {
    return { ok: false, kind: "region", reason: `That matches a whole area of ${component(top, "administrative_area_level_1")}, not a building. Add a street address or a city.` };
  }
  const loc = top.geometry.location;
  const city = component(top, "locality") ?? component(top, "administrative_area_level_3") ?? component(top, "sublocality") ?? component(top, "postal_town");
  return {
    ok: true,
    precision,
    partial: !!top.partial_match,
    address: {
      address_id: `live-${loc.lat().toFixed(5)},${loc.lng().toFixed(5)}`,
      street_address: headline(top, precision, city),
      postal_city: city ?? "",
      state: state as Address["state"],
      zip: component(top, "postal_code") ?? "",
      year_built: null,
      units: null,
      use_code: "",
      use_description: "",
      lat: loc.lat(),
      lng: loc.lng(),
      legal_city: city,
      county: component(top, "administrative_area_level_2"),
      geocode_match: "google",
    },
  };
}

async function firstHit(geocoder: google.maps.Geocoder, address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const { results } = await withTimeout(geocoder.geocode({ address, componentRestrictions: { country: "US" } }));
    const loc = results[0]?.geometry.location;
    return loc ? { lat: loc.lat(), lng: loc.lng() } : null;
  } catch {
    return null;
  }
}

export async function locate(geocoder: google.maps.Geocoder, a: Address): Promise<{ lat: number; lng: number } | null> {
  if (a.lat !== null && a.lng !== null) return { lat: a.lat, lng: a.lng };
  const place = `${a.postal_city}, ${a.state} ${a.zip}`.trim();
  return (await firstHit(geocoder, `${a.street_address}, ${place}`)) ?? (await firstHit(geocoder, place));
}
