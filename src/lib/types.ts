export type Category =
  | "rent_increase_limits"
  | "just_cause_eviction"
  | "security_deposits"
  | "application_screening_fees"
  | "screening_restrictions"
  | "algorithmic_rent_setting";

export type RuleStatus = "in_force" | "not_yet_effective" | "pending" | "failed";

export type LookupResult = "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending";

export interface Coverage {
  min_units: number | null;
  max_units: number | null;
  built_before: string | null;
  built_on_or_before: string | null;
  built_after: string | null;
  age_years_exempt: number | null;
  cutoff_basis: "year_built" | "certificate_of_occupancy" | "none";
  owner_type_dependent: boolean;
  unverifiable_conditions: string | null;
}

export interface Rule {
  team_rule_id: string;
  jurisdiction: string;
  level: "state" | "city";
  category: Category;
  status: RuleStatus;
  title: string;
  requirement: string;
  key_value: string | null;
  coverage_conditions: string;
  exemptions: string | null;
  coverage: Coverage;
  yields_to_local: boolean;
  overrides: string[];
  interaction: string | null;
  effective_date: string | null;
  citation: string;
  source_doc_id: string | null;
  source_url: string;
  retrieved_at: string | null;
  quoted_span: string;
  confidence: number | null;
  conflict_flag: boolean;
  conflict_note: string | null;
  conflicts_with: string[];
}

export interface Address {
  address_id: string;
  street_address: string;
  postal_city: string;
  state: "CA" | "NJ" | "MA";
  zip: string;
  year_built: number | null;
  units: number | null;
  use_code: string;
  use_description: string;
  lat: number | null;
  lng: number | null;
  legal_city: string | null;
  county: string | null;
  geocode_match: string | null;
}

export interface Evaluation {
  team_rule_id: string;
  result: LookupResult;
  explanation: string;
  conflict_flag: boolean;
}
