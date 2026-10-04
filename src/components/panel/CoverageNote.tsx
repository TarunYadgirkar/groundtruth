import { InfoIcon } from "@phosphor-icons/react";
import type { LiveInfo } from "@/lib/lookup";
import { isCoveredCity } from "@/lib/place";
import { localCoverageGaps } from "@/lib/coverage-gaps";
import { STATE_NAME } from "@/lib/labels";
import type { Address } from "@/lib/types";

const UNINCORPORATED = "Unincorporated ";

function coverageGap(a: Address): string | null {
  const city = a.legal_city;
  if (!city) return null;
  if (city.startsWith(UNINCORPORATED)) {
    const county = city.slice(UNINCORPORATED.length);
    return `This address is outside any city, in unincorporated ${county}. County ordinances aren't in our corpus yet, so only ${STATE_NAME[a.state]} statewide rules are shown.`;
  }
  const missing = localCoverageGaps(city, a.state);
  if (missing.length) return `Local laws for ${city} may be incomplete. Its ${missing.join(" and ")} is not included yet, so check the city's own rules too.`;
  if (isCoveredCity(city, a.state)) return null;
  return `Local ordinances for ${city} aren't in our corpus yet. Statewide rules only.`;
}

function provenance(live: LiveInfo): string {
  const match =
    live.precision === "address" ? "Matched to this building" : live.precision === "street" ? "Matched to the street, not a specific building" : "Matched to the city, not a specific building";
  const source = live.jurisdictionSource === "census" ? "city limits checked against Census boundaries" : "city from Google (Census boundary check unavailable)";
  return `${match} · ${source}`;
}

export default function CoverageNote({ address, live }: { address: Address; live: LiveInfo | null }) {
  const gap = coverageGap(address);
  return (
    <>
      {live && (
        <p className="font-mono text-[0.75rem] text-ink-muted">
          {live.cleanedQuery && <span className="block text-ink">Read your search as “{live.cleanedQuery}”</span>}
          {provenance(live)}
        </p>
      )}
      {gap && (
        <p className="flex gap-2 rounded-[var(--radius-control)] bg-surface-sunk px-3 py-2 text-caption text-ink shadow-[inset_0_0_0_1px_var(--hairline)]">
          <InfoIcon size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <span>{gap}</span>
        </p>
      )}
    </>
  );
}
