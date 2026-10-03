import type { Address } from "./types";

const SUFFIX: Record<string, string> = { av: "Ave", avenue: "Ave", street: "St", road: "Rd", boulevard: "Blvd", place: "Pl", terrace: "Ter" };
const UPPER = new Set(["ne", "nw", "se", "sw"]);

function word(w: string): string {
  const bare = w.replace(/\.$/, "");
  const lower = bare.toLowerCase();
  const ordinal = lower.match(/^0*(\d+)(st|nd|rd|th)$/);
  if (ordinal) return `${ordinal[1]}${ordinal[2]}`;
  if (UPPER.has(lower)) return lower.toUpperCase();
  if (/^\d/.test(lower)) return lower;
  return lower.replace(/(^|[-'])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

// Assessor rolls write streets as "397 05TH AV" or "59 OAK ST."; show "397 5th Ave".
export function displayStreet(raw: string): string {
  const words = raw
    .trim()
    .split(/\s+/)
    .map(word)
    .map((w, i, all) => (i > 0 && /^(apt|unit|#)$/i.test(all[i - 1]) ? w.replace(/^0+(?=\d)/, "") : w));
  const last = words.length - 1;
  if (last > 0) words[last] = SUFFIX[words[last].toLowerCase()] ?? words[last];
  return words.join(" ");
}

export function zipFromMatch(match: string | null): string {
  return match?.match(/,\s*(\d{5})\s*$/)?.[1] ?? "";
}

export interface LandUseLabel {
  label: string;
  code: string | null;
}

const CA_CODES: Record<string, string> = {
  A5: "Apartments, 5 to 14 units",
  A15: "Apartments, 15+ units",
  F5: "Flats, 5 to 14 units",
  FS5: "Flats over stores, 5 to 14 units",
  TIC: "Tenancy-in-common building, up to 4 units",
};

const MA_CODES: Record<string, string> = {
  "111": "Apartments, 4 to 8 units",
  "112": "Apartments, more than 8 units",
  "A/112": "Apartments, 7 to 30 units",
  "A/118": "Elderly housing",
  "A/120": "Luxury apartments",
  "A/125": "Subsidized housing (Section 8)",
};

function caLabel(a: Address): string {
  if (CA_CODES[a.use_code]) return CA_CODES[a.use_code];
  if (/^05/.test(a.use_code) || /\(5\+ units\)|five or more/i.test(a.use_description)) return "Apartments, 5+ units";
  return a.use_description;
}

function maLabel(a: Address): string {
  const base = MA_CODES[a.use_code];
  if (!base) return a.use_description;
  return /^MXD/i.test(a.use_description) ? `Mixed use, ${base.toLowerCase()}` : base;
}

// Turn assessor land-use codes ("A/125", "4C 3S-F-D-6U-NH", "SANDAG asr_landuse 14-16")
// into words, keeping the code for anyone checking the record.
export function landUseLabel(a: Address): LandUseLabel | null {
  if (!a.use_description && !a.use_code) return null;
  if (a.state === "NJ") return { label: "Apartments, 5+ units", code: `class ${a.use_code}${a.use_description && !/^Apartments/.test(a.use_description) ? ` · ${a.use_description}` : ""}` };
  const label = a.state === "CA" ? caLabel(a) : maLabel(a);
  const source = /SANDAG/.test(a.use_description) ? "SANDAG land use" : /Alameda/.test(a.use_description) ? "Alameda use code" : "use code";
  return { label, code: a.use_code ? `${source} ${a.use_code}` : null };
}
