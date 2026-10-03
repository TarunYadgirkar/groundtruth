import type { Address, Evaluation, LookupResult, Rule } from "./types";

type Coverage = "covered" | "excluded" | { unknown: string };

function appliesToPlace(rule: Rule, address: Address): boolean {
  if (rule.level === "state") return rule.jurisdiction === address.state;
  return rule.jurisdiction === `${address.legal_city}, ${address.state}`;
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

function checkBuilt(rule: Rule, year: number | null): Coverage {
  const c = rule.coverage;
  const cutoffs = [c.built_before, c.built_on_or_before, c.built_after].filter(Boolean);
  if (cutoffs.length === 0 && c.age_years_exempt === null) return "covered";
  if (year === null) return { unknown: "Coverage depends on the construction year, which is not in the public record for this building." };
  if (c.cutoff_basis === "certificate_of_occupancy" && cutoffs.some((d) => yearOf(d as string) === year)) {
    return { unknown: `Built in ${year}, the cutoff year. Coverage turns on the certificate of occupancy date, which the data does not include.` };
  }
  if (c.built_before && year >= yearOf(c.built_before)) return "excluded";
  if (c.built_on_or_before && year > yearOf(c.built_on_or_before)) return "excluded";
  if (c.built_after && year <= yearOf(c.built_after)) return "excluded";
  return "covered";
}

function checkUnits(rule: Rule, units: number | null): Coverage {
  const { min_units, max_units } = rule.coverage;
  if (min_units === null && max_units === null) return "covered";
  if (units === null) return { unknown: "Coverage depends on the unit count, which is not in the public record for this building." };
  if (min_units !== null && units < min_units) return "excluded";
  if (max_units !== null && units > max_units) return "excluded";
  return "covered";
}

function checkCoverage(rule: Rule, address: Address): Coverage {
  const checks = [checkBuilt(rule, address.year_built), checkUnits(rule, address.units)];
  if (checks.includes("excluded")) return "excluded";
  const unknown = checks.find((c) => typeof c === "object");
  if (unknown) return unknown;
  if (rule.coverage.owner_type_dependent) {
    return { unknown: "Coverage depends on who owns the building. Owner records are excluded from the data, so this cannot be resolved." };
  }
  return "covered";
}

function placeLabel(rule: Rule): string {
  return rule.level === "state" ? `statewide (${rule.jurisdiction})` : rule.jurisdiction;
}

function baseResult(rule: Rule, address: Address, asOf: string): { result: LookupResult; explanation: string } | null {
  if (rule.status === "failed") return null;
  if (rule.status === "pending") {
    return { result: "pending", explanation: `A proposal, not law. It would apply ${placeLabel(rule)} if enacted.` };
  }
  if (rule.effective_date && rule.effective_date > asOf) {
    return { result: "not_yet_effective", explanation: `Enacted, but takes effect ${rule.effective_date}, after the ${asOf} query date.` };
  }
  const coverage = checkCoverage(rule, address);
  if (coverage === "excluded") return null;
  if (typeof coverage === "object") return { result: "unknown", explanation: coverage.unknown };
  return { result: "applies", explanation: `In force ${placeLabel(rule)} and this building meets the coverage conditions.` };
}

export function evaluateAddress(address: Address, rules: Rule[], asOf: string): Evaluation[] {
  const local = rules.filter((r) => appliesToPlace(r, address));
  const base = local
    .map((rule) => ({ rule, out: baseResult(rule, address, asOf) }))
    .filter((x): x is { rule: Rule; out: NonNullable<ReturnType<typeof baseResult>> } => x.out !== null);

  const activeCityCategories = new Set(
    base.filter((x) => x.rule.level === "city" && x.out.result === "applies").map((x) => x.rule.category),
  );
  const liveIds = new Set(
    base.filter((x) => x.out.result === "applies" || x.out.result === "not_yet_effective").map((x) => x.rule.team_rule_id),
  );

  return base.map(({ rule, out }) => {
    const superseded = rule.level === "state" && rule.yields_to_local && out.result === "applies" && activeCityCategories.has(rule.category);
    const conflicting = rule.conflicts_with.filter((id) => liveIds.has(id));
    const conflict = liveIds.has(rule.team_rule_id) && conflicting.length > 0;
    return {
      team_rule_id: rule.team_rule_id,
      result: superseded ? "superseded" : out.result,
      explanation: superseded
        ? "Covers this building, but a stricter local rule in the same category governs here."
        : out.explanation,
      conflict_flag: conflict,
    };
  });
}
