import { DEFAULT_AS_OF, evaluateAddress, normalizeDate } from "./engine";
import { locateSpan, type Extraction } from "./extraction";
import type { Address, LookupResult, Rule } from "./types";

export interface IngestedRule extends Rule {
  quote_verified: boolean;
}

export interface AffectedAddress {
  address_id: string;
  street_address: string;
  legal_city: string | null;
  state: string;
  changes: { team_rule_id: string; title: string; now: LookupResult | "not_covered"; after: LookupResult | "not_covered" }[];
  superseded_existing: string[];
}

export interface IngestResult {
  rules: IngestedRule[];
  dropped: { title: string; reason: string }[];
  as_of: string;
  after_date: string;
  affected: AffectedAddress[];
  affected_count: number;
  total_addresses: number;
}

export function toRules(extraction: Extraction, sourceText: string, sourceLabel: string, retrievedAt: string): { rules: IngestedRule[]; dropped: IngestResult["dropped"] } {
  const dropped: IngestResult["dropped"] = [];
  const rules: IngestedRule[] = [];
  extraction.rules.forEach((r, i) => {
    const exact = locateSpan(sourceText, r.quoted_span);
    if (!exact) {
      dropped.push({ title: r.title, reason: "Quoted text could not be found verbatim in the document, so the rule was not used." });
      return;
    }
    rules.push({
      team_rule_id: `new-${String(i + 1).padStart(2, "0")}`,
      jurisdiction: r.jurisdiction,
      level: r.level,
      category: r.category,
      status: r.status,
      title: r.title,
      requirement: r.requirement,
      key_value: r.key_value,
      coverage_conditions: r.coverage_conditions,
      exemptions: r.exemptions,
      coverage: { ...r.coverage, owner_exemption_max_units: null },
      yields_to_local: r.yields_to_local,
      overrides: [],
      interaction: null,
      effective_date: r.effective_date,
      citation: r.citation,
      source_doc_id: null,
      source_url: sourceLabel,
      retrieved_at: retrievedAt,
      quoted_span: exact,
      confidence: r.confidence,
      conflict_flag: false,
      conflict_note: r.conflict_note,
      conflicts_with: [],
      quote_verified: true,
    });
  });
  return { rules, dropped };
}

// The date after which every new rule is in force, so "after" shows the full effect.
function afterDate(rules: Rule[], asOf: string): string {
  const dates = rules.map((r) => normalizeDate(r.effective_date)).filter((d): d is string => Boolean(d) && d! > asOf);
  if (!dates.length) return asOf;
  const latest = new Date(`${dates.sort().at(-1)}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + 1);
  return latest.toISOString().slice(0, 10);
}

export function affectedAddresses(newRules: Rule[], existing: Rule[], addresses: Address[], asOf = DEFAULT_AS_OF): Omit<IngestResult, "rules" | "dropped"> {
  const after = afterDate(newRules, asOf);
  const combined = [...existing, ...newRules];
  const newIds = new Set(newRules.map((r) => r.team_rule_id));
  const affected: AffectedAddress[] = [];

  for (const a of addresses) {
    const now = evaluateAddress(a, combined, asOf);
    const later = evaluateAddress(a, combined, after);
    const baseline = evaluateAddress(a, existing, after);
    const changes = newRules
      .map((r) => ({
        team_rule_id: r.team_rule_id,
        title: r.title,
        now: now.find((e) => e.team_rule_id === r.team_rule_id)?.result ?? ("not_covered" as const),
        after: later.find((e) => e.team_rule_id === r.team_rule_id)?.result ?? ("not_covered" as const),
      }))
      .filter((c) => c.now !== "not_covered" || c.after !== "not_covered");
    const supersededExisting = later
      .filter((e) => !newIds.has(e.team_rule_id) && e.result === "superseded")
      .filter((e) => baseline.find((b) => b.team_rule_id === e.team_rule_id)?.result !== "superseded")
      .map((e) => e.team_rule_id);
    if (changes.length || supersededExisting.length) {
      affected.push({
        address_id: a.address_id,
        street_address: a.street_address,
        legal_city: a.legal_city,
        state: a.state,
        changes,
        superseded_existing: supersededExisting,
      });
    }
  }
  return { as_of: asOf, after_date: after, affected, affected_count: affected.length, total_addresses: addresses.length };
}
