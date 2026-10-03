import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, writeJson } from "./lib/corpus";
import type { Address } from "../src/lib/types";

// Some NJ parcel rows carry the owner's mailing ZIP (e.g. Brooklyn, Austin) rather than the building's.
// When a ZIP can't belong to the address's state, show the ZIP from the geocoder's matched address instead.
const STATE_PREFIXES: Record<Address["state"], string[]> = { CA: ["9"], NJ: ["07", "08"], MA: ["01", "02"] };

function main(): void {
  const addresses: Address[] = JSON.parse(fs.readFileSync(path.join(DATA, "addresses.json"), "utf8"));
  const cache: Record<string, { match: string | null } | undefined> = JSON.parse(fs.readFileSync(path.join(DATA, "geocode-cache.json"), "utf8"));
  let fixed = 0;
  const out = addresses.map((a) => {
    if (!a.zip || STATE_PREFIXES[a.state].some((p) => a.zip.startsWith(p))) return a;
    const matched = cache[a.address_id]?.match?.match(/(\d{5})\s*$/)?.[1];
    if (!matched || !STATE_PREFIXES[a.state].some((p) => matched.startsWith(p))) return { ...a, zip: "" };
    fixed++;
    return { ...a, zip: matched };
  });
  writeJson(path.join(DATA, "addresses.json"), out);
  writeJson(path.join(ROOT, "src/data/addresses.json"), out);
  console.log(`zips corrected from geocoder match: ${fixed}`);
}

main();
