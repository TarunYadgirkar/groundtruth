import type { Address } from "./types";

const ABBREV: Record<string, string> = {
  street: "st",
  avenue: "ave",
  road: "rd",
  boulevard: "blvd",
  drive: "dr",
  place: "pl",
  terrace: "ter",
  court: "ct",
  lane: "ln",
};

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => ABBREV[w] ?? w);
}

interface Indexed {
  address: Address;
  words: string[];
}

export function buildIndex(addresses: Address[]): Indexed[] {
  return addresses.map((address) => ({
    address,
    words: normalize(
      [address.street_address, address.postal_city, address.legal_city ?? "", address.state, address.zip, address.address_id].join(" "),
    ),
  }));
}

// A finished house number must match exactly ("1 Beacon" is not "197 Beacon"); only the
// token still being typed can be a prefix.
function tokenScore(token: string, words: string[], isLast: boolean): number {
  const numeric = /^\d+$/.test(token);
  let best = -1;
  words.forEach((w, i) => {
    if (w === token) best = Math.max(best, 3 - i * 0.01);
    else if (numeric && !isLast) return;
    else if (w.startsWith(token)) best = Math.max(best, 2 - i * 0.01);
    else if (!numeric && token.length >= 3 && w.includes(token)) best = Math.max(best, 0.5);
  });
  return best;
}

export function searchAddresses(index: Indexed[], query: string, limit = 6): Address[] {
  const tokens = normalize(query);
  if (tokens.length === 0) return [];
  const scored: { address: Address; score: number }[] = [];
  for (const item of index) {
    let total = 0;
    let ok = true;
    for (const [i, t] of tokens.entries()) {
      const s = tokenScore(t, item.words, i === tokens.length - 1);
      if (s < 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) scored.push({ address: item.address, score: total });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.address.street_address.localeCompare(b.address.street_address))
    .slice(0, limit)
    .map((s) => s.address);
}
