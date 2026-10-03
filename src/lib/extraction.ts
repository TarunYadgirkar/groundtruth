import { z } from "zod";

export const JURISDICTIONS = [
  "CA",
  "NJ",
  "MA",
  "Los Angeles, CA",
  "San Francisco, CA",
  "San Diego, CA",
  "Berkeley, CA",
  "Santa Ana, CA",
  "Jersey City, NJ",
  "Hoboken, NJ",
  "Newark, NJ",
  "Boston, MA",
  "Cambridge, MA",
] as const;

export const CATEGORIES = [
  "rent_increase_limits",
  "just_cause_eviction",
  "security_deposits",
  "application_screening_fees",
  "screening_restrictions",
  "algorithmic_rent_setting",
] as const;

export const STATUSES = ["in_force", "not_yet_effective", "pending", "failed"] as const;

export const CoverageSchema = z.object({
  min_units: z.number().nullable().describe("Minimum unit count in the building for the rule to apply, or null"),
  max_units: z.number().nullable().describe("Maximum unit count, or null"),
  built_before: z
    .string()
    .nullable()
    .describe("ISO date: rule covers buildings built/certified BEFORE this date (exclusive), or null"),
  built_on_or_before: z
    .string()
    .nullable()
    .describe("ISO date: rule covers buildings built/certified ON OR BEFORE this date, or null"),
  built_after: z
    .string()
    .nullable()
    .describe("ISO date: rule covers only buildings built AFTER this date, or null"),
  age_years_exempt: z
    .number()
    .nullable()
    .describe("Rolling exemption, e.g. CA AB 1482 exempts buildings with a certificate of occupancy issued within the previous 15 years -> 15"),
  cutoff_basis: z
    .enum(["year_built", "certificate_of_occupancy", "none"])
    .describe("What the date cutoff is measured on"),
  owner_type_dependent: z
    .boolean()
    .describe("True if applicability depends on owner type (natural person, corporation, REIT, small landlord) or owner occupancy"),
  unverifiable_conditions: z
    .string()
    .nullable()
    .describe("Other coverage conditions that cannot be checked from year built / units / use code (e.g. required notice given, subsidized housing), or null"),
});

export const ExtractedRuleSchema = z.object({
  canonical_key: z
    .string()
    .describe("Stable slug for this legal rule so duplicates across documents merge, e.g. 'CA-CIV-1947.12-rent-cap' or 'HOBOKEN-158-II-algorithmic-ban'"),
  jurisdiction: z.enum(JURISDICTIONS),
  level: z.enum(["state", "city"]),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES).describe("As of 2026-10-01"),
  title: z.string(),
  requirement: z.string().describe("One or two plain-language sentences"),
  key_value: z.string().nullable().describe("Headline number or formula, e.g. '5% + CPI, max 10%'"),
  coverage_conditions: z.string().describe("Plain-language who/what is covered"),
  exemptions: z.string().nullable(),
  coverage: CoverageSchema,
  yields_to_local: z
    .boolean()
    .describe("True when this (state) rule does not govern where a stricter local rule in the same category covers the unit, e.g. AB 1482 vs local rent control"),
  effective_date: z.string().nullable().describe("YYYY-MM-DD (or YYYY-MM / YYYY) when the rule takes/took effect"),
  enacted_date: z.string().nullable(),
  penalty: z.string().nullable(),
  citation: z.string().describe("Official cite, e.g. 'Cal. Civ. Code § 1947.12'"),
  quoted_span: z
    .string()
    .describe("EXACT contiguous text copied character-for-character from the document that supports the rule; 1-3 sentences"),
  confidence: z.number().describe("0 to 1"),
  conflict_note: z
    .string()
    .nullable()
    .describe("Note conflicting dates/values across sources, possible preemption, or legal uncertainty"),
});

export const ExtractionSchema = z.object({
  rules: z.array(ExtractedRuleSchema),
  no_rule_findings: z
    .array(
      z.object({
        jurisdiction: z.enum(JURISDICTIONS),
        category: z.enum(CATEGORIES),
        finding: z.string().describe("e.g. 'State law bars local rent control; no rent cap at this level'"),
        quoted_span: z.string().nullable(),
      }),
    )
    .describe("Explicit statements in this document that NO rule exists at a level (e.g. MA bars rent control, ballot question struck)"),
});

export type ExtractedRule = z.infer<typeof ExtractedRuleSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
