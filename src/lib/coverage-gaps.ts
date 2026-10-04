import { RULES } from "./data";
import type { Address, Category } from "./types";

interface KnownLocalLaw {
  city: string;
  state: Address["state"];
  category: Category;
  law: string;
}

// Local laws a city is known to have that the corpus pipeline could not capture text for. An entry
// drops out on its own once a city rule in that category exists.
const KNOWN_LOCAL_LAWS: KnownLocalLaw[] = [
  { city: "Hoboken", state: "NJ", category: "rent_increase_limits", law: "rent control ordinance" },
  { city: "Newark", state: "NJ", category: "rent_increase_limits", law: "rent control ordinance" },
];

export function localCoverageGaps(city: string | null, state: Address["state"]): string[] {
  if (!city) return [];
  const jurisdiction = `${city}, ${state}`;
  return KNOWN_LOCAL_LAWS.filter(
    (k) => k.city === city && k.state === state && !RULES.some((r) => r.jurisdiction === jurisdiction && r.category === k.category),
  ).map((k) => k.law);
}
