import { z } from "zod";
import { evaluateAddress } from "./engine";
import type { Address, Category, Coverage, Evaluation, Rule, RuleStatus } from "./types";

export const CORPUS_STATES = ["CA", "NJ", "MA"] as const;

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

const PLACE_NAME = /^[\p{L}][\p{L} .'\-]{0,59}$/u;

export const ResearchRequest = z.object({
  city: z.string().trim().regex(PLACE_NAME),
  state: z.enum(US_STATES),
  county: z.string().trim().regex(PLACE_NAME).nullish(),
});
export type ResearchRequest = z.infer<typeof ResearchRequest>;

export interface LiveRule {
  id: string;
  category: Category;
  level: "state" | "city";
  jurisdiction: string;
  status: RuleStatus;
  title: string;
  requirement: string;
  key_value: string | null;
  coverage_conditions: string;
  exemptions: string | null;
  coverage: Coverage;
  yields_to_local: boolean;
  effective_date: string | null;
  citation: string;
  source_url: string;
  fetched_at: string;
  quoted_span: string;
  confidence: number;
  official_source: boolean;
  live_research: true;
}

export interface ResearchResult {
  city: string;
  state: string;
  rules: LiveRule[];
  pages_read: number;
  dropped: number;
  researched_at: string;
  cached: boolean;
}

export type ResearchStage = "searching" | "reading" | "verifying";

export type ResearchEvent =
  | { type: "stage"; stage: ResearchStage; pages: number }
  | { type: "result"; result: ResearchResult }
  | { type: "error"; message: string };

export function isCorpusState(state: string): state is Address["state"] {
  return (CORPUS_STATES as readonly string[]).includes(state);
}

export function toRule(r: LiveRule): Rule {
  return {
    team_rule_id: r.id,
    jurisdiction: r.jurisdiction,
    level: r.level,
    category: r.category,
    status: r.status,
    title: r.title,
    requirement: r.requirement,
    key_value: r.key_value,
    coverage_conditions: r.coverage_conditions,
    exemptions: r.exemptions,
    // Live results are unreviewed: any stated condition we cannot check keeps the rule at unknown.
    coverage: { ...r.coverage, depends_on_unknown_fact: Boolean(r.coverage.depends_on_unknown_fact || r.coverage.unverifiable_conditions) },
    yields_to_local: r.yields_to_local,
    overrides: [],
    interaction: null,
    effective_date: r.effective_date,
    citation: r.citation,
    source_doc_id: null,
    source_url: r.source_url,
    retrieved_at: r.fetched_at,
    quoted_span: r.quoted_span,
    confidence: r.confidence,
    conflict_flag: false,
    conflict_note: null,
    conflicts_with: [],
  };
}

// The engine only compares jurisdiction strings, so an out-of-state place runs through it as a
// stand-in address with the researched city as its legal city and no building facts.
function placeAddress(city: string, state: string, county: string | null): Address {
  return {
    address_id: `live-research-${city}-${state}`,
    street_address: city,
    postal_city: city,
    state: state as Address["state"],
    zip: "",
    year_built: null,
    units: null,
    use_code: "",
    use_description: "",
    lat: null,
    lng: null,
    legal_city: city,
    county,
    geocode_match: null,
  };
}

export function evaluateLive(rules: LiveRule[], target: { address: Address } | { city: string; state: string; county: string | null }, asOf: string): Evaluation[] {
  const base = "address" in target ? target.address : placeAddress(target.city, target.state, target.county);
  const city = rules.find((r) => r.level === "city")?.jurisdiction.split(", ")[0];
  const address = city ? { ...base, legal_city: city } : base;
  return evaluateAddress(address, rules.map(toRule), asOf);
}
