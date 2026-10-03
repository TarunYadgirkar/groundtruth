import type { Address } from "./types";

const SUPPORTED = new Set(["CA", "NJ", "MA"]);
const TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

export type GeocodeOutcome =
  | { ok: true; address: Address }
  | { ok: false; reason: string };

function component(result: google.maps.GeocoderResult, type: string, short = false): string | null {
  const c = result.address_components.find((x) => x.types.includes(type));
  if (!c) return null;
  return short ? c.short_name : c.long_name;
}

export async function geocodeFreeText(geocoder: google.maps.Geocoder, query: string): Promise<GeocodeOutcome> {
  let results: google.maps.GeocoderResult[];
  try {
    ({ results } = await withTimeout(geocoder.geocode({ address: query, componentRestrictions: { country: "US" } })));
  } catch {
    return { ok: false, reason: "We couldn't find that address. Check the spelling, or include the city and state." };
  }
  const top = results[0];
  if (!top) return { ok: false, reason: "We couldn't find that address. Check the spelling, or include the city and state." };
  const state = component(top, "administrative_area_level_1", true);
  if (!state || !SUPPORTED.has(state)) {
    return { ok: false, reason: "Groundtruth covers California, New Jersey and Massachusetts. That address is outside them." };
  }
  const loc = top.geometry.location;
  const street = [component(top, "street_number"), component(top, "route", true)].filter(Boolean).join(" ");
  const city = component(top, "locality") ?? component(top, "sublocality") ?? component(top, "postal_town");
  return {
    ok: true,
    address: {
      address_id: `live-${loc.lat().toFixed(5)},${loc.lng().toFixed(5)}`,
      street_address: street || top.formatted_address.split(",")[0],
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
