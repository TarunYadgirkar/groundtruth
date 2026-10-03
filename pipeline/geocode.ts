import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { DATA, ROOT, STARTER, parseCsv, writeJson } from "./lib/corpus";

config({ path: path.join(ROOT, ".env.local"), quiet: true });
import type { Address } from "../src/lib/types";

const CENSUS = "https://geocoding.geo.census.gov/geocoder";
const BENCH = "benchmark=Public_AR_Current&vintage=Current_Current";
const CACHE = path.join(DATA, "geocode-cache.json");

interface Geo {
  lat: number | null;
  lng: number | null;
  match: string | null;
  legal_city: string | null;
  county: string | null;
}

const PLACE_NAMES: Record<string, string> = {
  "Los Angeles city": "Los Angeles",
  "San Francisco city": "San Francisco",
  "San Diego city": "San Diego",
  "Berkeley city": "Berkeley",
  "Jersey City city": "Jersey City",
  "Hoboken city": "Hoboken",
  "Newark city": "Newark",
  "Boston city": "Boston",
  "Cambridge city": "Cambridge",
};

async function batchGeocode(rows: Record<string, string>[]): Promise<Map<string, { lat: number; lng: number; match: string }>> {
  const csv = rows.map((r) => [r.address_id, r.street_address, r.postal_city, r.state, r.zip].map((v) => `"${v.replace(/"/g, "")}"`).join(",")).join("\n");
  const form = new FormData();
  form.append("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");
  form.append("benchmark", "Public_AR_Current");
  const res = await fetch(`${CENSUS}/locations/addressbatch`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`census batch ${res.status}`);
  const out = new Map<string, { lat: number; lng: number; match: string }>();
  for (const line of (await res.text()).split("\n")) {
    const cells = parseCsv(`a,b,c,d,e,f,g,h\n${line}\n`)[0];
    if (!cells || cells.c !== "Match") continue;
    const [lng, lat] = cells.f.split(",").map(Number);
    const input = rows.find((r) => r.address_id === cells.a);
    if (input && !sameHouseNumber(input.street_address, cells.e)) continue;
    out.set(cells.a, { lat, lng, match: cells.e });
  }
  return out;
}

async function placeFor(lat: number, lng: number): Promise<{ legal_city: string | null; county: string | null }> {
  const url = `${CENSUS}/geographies/coordinates?x=${lng}&y=${lat}&${BENCH}&layers=Incorporated%20Places,Counties&format=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const geos = (await res.json()).result?.geographies ?? {};
    const place: string | undefined = geos["Incorporated Places"]?.[0]?.NAME;
    const county: string | undefined = geos["Counties"]?.[0]?.NAME;
    return { legal_city: place ? (PLACE_NAMES[place] ?? place) : null, county: county ?? null };
  }
  return { legal_city: null, county: null };
}

const POSTAL_INSIDE_CITY: Record<string, { city: string; county: string }> = {
  "San Francisco": { city: "San Francisco", county: "San Francisco County" },
  Dorchester: { city: "Boston", county: "Suffolk County" },
  Roxbury: { city: "Boston", county: "Suffolk County" },
  Cambridge: { city: "Cambridge", county: "Middlesex County" },
  Hoboken: { city: "Hoboken", county: "Hudson County" },
};

// Only used when no point geocode exists: SF is a consolidated city-county and these are Boston neighborhoods,
// so the postal name alone fixes the legal city. Ambiguous postal names stay null.
function inferFromPostal(postal: string): { match: string | null; legal_city: string | null; county: string | null } {
  const hit = POSTAL_INSIDE_CITY[postal];
  return hit
    ? { match: `inferred from postal city "${postal}" (no street-level match)`, legal_city: hit.city, county: hit.county }
    : { match: null, legal_city: null, county: null };
}

// Reject fuzzy matches that land on a different building number (e.g. "322 Western Ave" -> "5 WESTERN AVE").
function sameHouseNumber(input: string, matched: string): boolean {
  const want = input.match(/^\s*(\d+)/)?.[1];
  if (!want) return true;
  return matched.match(/^\s*(\d+)/)?.[1] === want;
}

function cleanStreet(street: string): string {
  return street
    .replace(/^(\d+)[A-Z]?\s*-\s*\d+[A-Z]?\b/, "$1")
    .replace(/\s+(REAR|UNIT|APT|LOT|#).*$/i, "")
    .replace(/\b0(\d)(ST|ND|RD|TH)\b/gi, "$1$2")
    .replace(/\bAV\b/i, "AVE")
    .replace(/\s+/g, " ")
    .trim();
}

async function censusOneLine(r: Record<string, string>): Promise<{ lat: number; lng: number; match: string } | null> {
  for (const zip of [r.zip, ""]) {
    const q = encodeURIComponent(`${cleanStreet(r.street_address)}, ${r.postal_city}, ${r.state} ${zip}`.trim());
    const res = await fetch(`${CENSUS}/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`);
    if (!res.ok) continue;
    const hit = (await res.json()).result?.addressMatches?.[0];
    if (hit && sameHouseNumber(r.street_address, hit.matchedAddress)) return { lat: hit.coordinates.y, lng: hit.coordinates.x, match: `census-clean: ${hit.matchedAddress}` };
  }
  return null;
}

async function googleGeocode(r: Record<string, string>): Promise<{ lat: number; lng: number; match: string } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const q = encodeURIComponent(`${r.street_address}, ${r.postal_city}, ${r.state} ${r.zip}`);
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`);
  const body = await res.json();
  const hit = body.results?.[0];
  if (!hit) {
    console.warn(`google geocode ${r.address_id}: ${body.status} ${body.error_message ?? ""}`);
    return null;
  }
  return { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, match: `google: ${hit.formatted_address}` };
}

async function main(): Promise<void> {
  const rows = parseCsv(fs.readFileSync(path.join(STARTER, "data/sample_addresses.csv"), "utf8"));
  const cache: Record<string, Geo> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  const todo = rows.filter((r) => !cache[r.address_id]?.legal_city);

  const points = await batchGeocode(todo);
  console.log(`census matched ${points.size}/${todo.length}`);

  const queue = [...todo];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const pt = points.get(r.address_id) ?? (await censusOneLine(r)) ?? (await googleGeocode(r));
        cache[r.address_id] = pt
          ? { lat: pt.lat, lng: pt.lng, match: pt.match, ...(await placeFor(pt.lat, pt.lng)) }
          : { lat: null, lng: null, ...inferFromPostal(r.postal_city) };
      }
    }),
  );
  writeJson(CACHE, cache);

  const addresses: Address[] = rows.map((r) => ({
    address_id: r.address_id,
    street_address: r.street_address,
    postal_city: r.postal_city,
    state: r.state as Address["state"],
    zip: r.zip,
    year_built: r.year_built ? Number(r.year_built) : null,
    units: r.units ? Number(r.units) : null,
    use_code: r.use_code,
    use_description: r.use_description,
    ...cache[r.address_id],
    geocode_match: cache[r.address_id]?.match ?? null,
  })).map(({ match: _m, ...a }) => a as Address);

  writeJson(path.join(DATA, "addresses.json"), addresses);
  const byCity = new Map<string, number>();
  for (const a of addresses) byCity.set(`${a.postal_city} -> ${a.legal_city}`, (byCity.get(`${a.postal_city} -> ${a.legal_city}`) ?? 0) + 1);
  console.log([...byCity].map(([k, v]) => `${v}\t${k}`).sort().join("\n"));
}

await main();
