import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, writeJson } from "./lib/corpus";
import type { Address } from "../src/lib/types";

// Census gives street-interpolated points; the 3D camera needs the building itself.
// Replace lat/lng with Google ROOFTOP geocodes when the house number matches. Legal city stays from Census.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const CACHE = path.join(DATA, "rooftop-cache.json");

async function main(): Promise<void> {
  if (!KEY) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set in the process env");
  const addresses: Address[] = JSON.parse(fs.readFileSync(path.join(DATA, "addresses.json"), "utf8"));
  const cache: Record<string, { lat: number; lng: number; type: string } | null> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  const todo = addresses.filter((a) => !(a.address_id in cache));
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        const q = encodeURIComponent(`${a.street_address}, ${a.legal_city ?? a.postal_city}, ${a.state} ${a.zip}`);
        const body = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${KEY}`).then((r) => r.json());
        const hit = body.results?.[0];
        const want = a.street_address.match(/^\s*(\d+)/)?.[1];
        const got = hit?.address_components?.find((c: { types: string[] }) => c.types.includes("street_number"))?.long_name;
        cache[a.address_id] = hit && (!want || got === want) ? { ...hit.geometry.location, type: hit.geometry.location_type } : null;
      }
    }),
  );
  writeJson(CACHE, cache);

  let moved = 0;
  const refined = addresses.map((a) => {
    const hit = cache[a.address_id];
    if (!hit || hit.type !== "ROOFTOP") return a;
    moved++;
    return { ...a, lat: hit.lat, lng: hit.lng };
  });
  writeJson(path.join(DATA, "addresses.json"), refined);
  writeJson(path.join(ROOT, "src/data/addresses.json"), refined);
  console.log(`rooftop points ${moved}/${addresses.length}`);
}

await main();
