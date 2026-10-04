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
  depends_on_unknown_fact: z
    .boolean()
    .describe(
      "True only when whether the rule covers a building at all turns on a fact about the building, unit or its history that public records lack and that most otherwise-covered buildings would not meet: only subsidized or program units, only units being converted to condominiums, only demolished protected units, only units registered in a program. False when unverifiable_conditions only describe the conduct the rule regulates (using a pricing algorithm, serving a notice, charging a fee, a tenant's length of tenancy) or a narrow exemption from an otherwise general rule.",
    ),
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
    .describe(
      "EXACT contiguous text copied character-for-character from the document: the operative sentence that states the obligation, prohibition, number or date (1-3 sentences, a full sentence with a verb). Never a heading, title, menu item or table label.",
    ),
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

export const EXTRACTION_SYSTEM = `You extract U.S. rental housing rules from one source document into structured records for an address-level law lookup tool.

Scope: 3 states (CA, NJ, MA) and these jurisdictions only: ${JURISDICTIONS.join("; ")}.
Six categories only: ${CATEGORIES.join(", ")}.
Query date: 2026-10-01.

How to extract:
- One record per distinct legal rule the document states or describes (a cap, a ban, a required cause, a fee limit, a screening restriction). Split a statute into separate records when it creates rules in different categories.
- Include rules that are enacted but not yet effective (status not_yet_effective), pending bills (pending), and failed/struck measures (failed) when the document describes them.
- Secondary or summary pages count: if a city web page describes a city ordinance, extract the ordinance with its official citation when the page gives one.
- quoted_span must be copied EXACTLY from the document text, character for character, contiguous, 1-3 sentences. Never paraphrase, never stitch fragments together, never fix typos.
- quoted_span must be the operative sentence that states the obligation, prohibition, number or date the rule record asserts: a full sentence with a verb, normally 60+ characters. Never quote a heading, page title, menu item, list label or bare table cell (e.g. "Legal Reasons for Eviction" or "Interest Payments on Security Deposits" are headings, not support). If the only supporting text is a list, quote the sentence that introduces or governs the list. When the document states a rate or amount only in a rate table or rate line (an official current-rates page), quote the contiguous label and value lines together, including the dates, e.g. "Security Deposit Interest:\n4.2% for March 1, 2026 - February 28, 2027". If the document has neither an operative sentence nor such a dated rate line for a rule, do not extract that rule from this document. Exception: for a pending or failed bill, the bill's own title ("An Act ...") is acceptable support for the fact that the bill exists.
- Coverage: fill the structured coverage block precisely. Use certificate_of_occupancy when the law keys on a certificate of occupancy or "first occupied" date, year_built only when it keys on construction date. Leave fields null when the document does not state them. Do not invent cutoffs.
- yields_to_local: true for state rules that by their own terms do not apply where stricter local rent control / just-cause rules apply (e.g. Cal. Civ. Code 1947.12 and 1946.2 carve-outs).
- effective_date: use the date the document states. If it only shows enactment (e.g. a chaptered California bill), apply the state's default effective-date rule (California regular-session statutes: January 1 of the following year; urgency statutes: on signing) and say so in conflict_note with confidence <= 0.8.
- Record conflicting effective dates or possible preemption in conflict_note and lower confidence.
- Category mapping: tenant-protection notice/disclosure ordinances tied to the start or termination of a tenancy (e.g. tenant rights notices, housing stability notification acts), relocation assistance and eviction procedure belong to just_cause_eviction; source-of-income, criminal-history and credit screening limits belong to screening_restrictions; fee caps and allowed upfront charges belong to application_screening_fees.
- Exemptions are not rules: express a new-construction or owner-occupancy exemption as coverage on the rule it exempts from, not as its own record.
- If a rule covers only a restricted population (subsidized/affordable units, city-funded units, specific programs), say so in unverifiable_conditions and start that text with "RESTRICTED:".
- depends_on_unknown_fact: true when coverage turns on a building fact public records lack (restricted population, condo conversion, demolition, program registration); false when the condition is only the regulated conduct or a narrow exemption.
- If the document is irrelevant to the six categories, return empty arrays.
- no_rule_findings: explicit statements that no rule exists at a level (e.g. Massachusetts bars local rent control; a ballot question was struck).
Never invent rules, citations, or dates that the document does not support.`;

const VERB =
  /\b(shall|must|may|might|is|are|was|were|be|been|being|has|have|had|will|would|can|cannot|could|should|does|do|did|apply|applies|applied|require[sd]?|prohibit(s|ed)?|ban(s|ned)?|bar(s|red)?|allow(s|ed)?|permit(s|ted)?|limit(s|ed)?|cap(s|ped)?|exempt(s|ed)?|cover(s|ed)?|provide[sd]?|include[sd]?|accrue[sd]?|charge[sd]?|increase[sd]?|take[sn]?|took|go(es)?|went|protect(s|ed)?|pay|pays|paid|evict(s|ed)?|terminate[sd]?|receive[sd]?|return(s|ed)?|set(s)?|adopt(s|ed)?|enact(s|ed)?|expire[sd]?|establish(es|ed)?|make[sd]?|made|give[sn]?|gave|need(s|ed)?|tell(s)?|refuse[sd]?|discriminate[sd]?|accept(s|ed)?|use[sd]?|mean[st]?|entitle[sd]?)\b/i;

// Official rate pages state values as "4.2% for March 1, 2026 - February 28, 2027": a figure tied to a date.
const isDatedRateLine = (text: string) => text.length >= 30 && /\d(\.\d+)?\s?%|\$\s?\d/.test(text) && /\b(19|20)\d\d\b/.test(text);

// A quote supports a rule only if it reads as an operative sentence: long enough, has a verb, and
// is not a title-case heading or menu label.
export function isSubstantiveQuote(quote: string): boolean {
  const text = quote.replace(/\s+/g, " ").trim();
  if (isDatedRateLine(text)) return true;
  if (text.length < 60 || !VERB.test(text)) return false;
  const words = text.split(" ").filter((w) => /^[A-Za-z]/.test(w));
  const capitalized = words.filter((w) => /^[A-Z]/.test(w)).length;
  const headingLike = !/[.;:)]$/.test(text) && words.length > 0 && capitalized / words.length > 0.6;
  return !headingLike;
}

export function quoteSupportsRule(quote: string, status: string): boolean {
  if (isSubstantiveQuote(quote)) return true;
  return (status === "pending" || status === "failed") && /^An Act\b/.test(quote.trim());
}

const QUOTES = /[\u2018\u2019\u201A\u201B\u2032]/g;
const DQUOTES = /[\u201C\u201D\u201E\u201F\u2033]/g;
const DASHES = /[\u2010-\u2015]/g;

function normChar(ch: string): string {
  return ch.replace(QUOTES, "'").replace(DQUOTES, '"').replace(DASHES, "-").replace(/\u00A0/g, " ");
}

// Locate the span in the source ignoring whitespace runs and quote/dash style, then return the
// exact original substring so quoted_span is always verbatim source text.
export function locateSpan(doc: string, span: string): string | null {
  const keep: number[] = [];
  let norm = "";
  for (let i = 0; i < doc.length; i++) {
    const ch = normChar(doc[i]);
    if (/\s/.test(ch)) {
      if (norm.endsWith(" ")) continue;
      norm += " ";
    } else norm += ch;
    keep.push(i);
  }
  const target = normChar(span).replace(/\s+/g, " ").trim();
  if (target.length < 20) return null;
  const at = norm.indexOf(target);
  if (at < 0) return null;
  return doc.slice(keep[at], keep[at + target.length - 1] + 1);
}
