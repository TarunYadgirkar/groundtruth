import { ADDRESSES } from "./data";
import { geocodeFreeText, isBetter, type GeocodeOutcome, type OutOfScopePlace, type Precision } from "./geocode";
import { lookupPlace, normalizeQuery, type PlaceLookup } from "./place";
import type { Address } from "./types";

export interface LiveInfo {
  precision: Precision;
  jurisdictionSource: "census" | "google";
  placeKind: PlaceLookup["kind"] | null;
  cleanedQuery: string | null;
}

export type LookupOutcome =
  | { ok: true; address: Address; live: LiveInfo | null }
  | { ok: false; reason: string; outOfScope: boolean; place?: OutOfScopePlace };

const SAMPLE_SNAP_METERS = 40;
const METERS_PER_DEGREE = 111_320;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function sameHouseNumber(sampleStreet: string, number: number): boolean {
  const [lo, hi] = (sampleStreet.match(/^(\d+)(?:-(\d+))?\s/)?.slice(1) ?? []).map(Number);
  if (!lo) return false;
  return number === lo || (!!hi && number >= lo && number <= hi);
}

// A sample building typed in a form the search box didn't match ("6238 De Longpre Avenue, Hollywood")
// should still open with its public-record facts.
function matchingSample(live: Address): Address | null {
  const number = Number(live.street_address.match(/^\d+/)?.[0]);
  if (!number || live.lat == null || live.lng == null) return null;
  const here = { lat: live.lat, lng: live.lng };
  return (
    ADDRESSES.find(
      (a) => a.lat != null && a.lng != null && sameHouseNumber(a.street_address, number) && distanceMeters(here, { lat: a.lat, lng: a.lng }) < SAMPLE_SNAP_METERS,
    ) ?? null
  );
}

async function geocodeWithCleanup(geocoder: google.maps.Geocoder, query: string): Promise<{ out: GeocodeOutcome; cleaned: string | null }> {
  const first = await geocodeFreeText(geocoder, query);
  if (!first.ok && first.kind === "out_of_scope") return { out: first, cleaned: null };
  if (first.ok && first.precision === "address" && !first.partial) return { out: first, cleaned: null };
  const cleaned = await normalizeQuery(query);
  if (!cleaned || squash(cleaned) === squash(query)) return { out: first, cleaned: null };
  const retry = await geocodeFreeText(geocoder, cleaned);
  const retryOutOfScope = !retry.ok && retry.kind === "out_of_scope" && !first.ok;
  return isBetter(retry, first) || retryOutOfScope ? { out: retry, cleaned } : { out: first, cleaned: null };
}

function applyPlace(address: Address, place: PlaceLookup | null): { address: Address; source: LiveInfo["jurisdictionSource"] } {
  if (!place) return { address, source: "google" };
  const county = place.county ?? address.county;
  if (place.kind === "unincorporated") return { address: { ...address, legal_city: `Unincorporated ${county ?? "county"}`, county }, source: "census" };
  return { address: { ...address, legal_city: place.city, county }, source: "census" };
}

export async function resolveFreeText(geocoder: google.maps.Geocoder, query: string): Promise<LookupOutcome> {
  const { out, cleaned } = await geocodeWithCleanup(geocoder, query);
  if (!out.ok) return { ok: false, reason: out.reason, outOfScope: out.kind !== "not_found", place: out.place };

  const sample = out.precision === "address" ? matchingSample(out.address) : null;
  if (sample) return { ok: true, address: sample, live: null };

  const place = await lookupPlace(out.address.lat as number, out.address.lng as number);
  const { address, source } = applyPlace(out.address, place);
  return {
    ok: true,
    address: { ...address, geocode_match: source === "census" ? "google+census" : "google" },
    live: { precision: out.precision, jurisdictionSource: source, placeKind: place?.kind ?? null, cleanedQuery: cleaned },
  };
}
