import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DATA, ROOT, loadCorpus, writeJson } from "./lib/corpus";
import { CATEGORIES, CoverageSchema, JURISDICTIONS, STATUSES, locateSpan, quoteSupportsRule, type Extraction, type ExtractedRule } from "../src/lib/extraction";
import type { Rule } from "../src/lib/types";

const MODEL = "claude-opus-5-5";
const client = new Anthropic({ maxRetries: 8 });

interface Candidate extends ExtractedRule {
  id: string;
  doc_id: string;
  source_url: string;
  retrieved_at: string;
  quote_verified: boolean;
}

const ConsolidatedSchema = z.object({
  rules: z.array(
    z.object({
      key: z.string().describe("Unique short key for this final rule, e.g. 'ca-1947.12-rent-cap'"),
      primary_candidate: z
        .string()
        .describe("Candidate id whose quote best supports the rule: verified and substantive (the operative sentence stating the obligation, number or date), from the most official source. Never a heading-only quote."),
      merged_candidates: z.array(z.string()),
      jurisdiction: z.enum(JURISDICTIONS),
      level: z.enum(["state", "city"]),
      category: z.enum(CATEGORIES),
      status: z.enum(STATUSES).describe("As of 2026-10-01"),
      title: z.string(),
      requirement: z.string(),
      key_value: z.string().nullable(),
      coverage_conditions: z.string(),
      exemptions: z.string().nullable(),
      coverage: CoverageSchema.extend({
        owner_exemption_max_units: z
          .number()
          .nullable()
          .describe("If owner_type_dependent, the largest building (units) to which the owner-type exception could possibly apply, e.g. CA small-landlord deposit exception: 4; AB 1482 natural-person single-family exemption: 1; NJ owner-occupied <=2 units: 2. null if not bounded"),
      }),
      yields_to_local: z.boolean(),
      effective_date: z.string().nullable(),
      citation: z.string(),
      conflicts_with_keys: z.array(z.string()).describe("Keys of other final rules this may conflict with or be preempted by (e.g. NJ FAIR Act vs Jersey City / Hoboken local bans)"),
      conflict_note: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
  dropped: z.array(z.object({ candidate: z.string(), reason: z.string() })),
  gaps: z.array(z.object({ jurisdiction: z.enum(JURISDICTIONS), category: z.enum(CATEGORIES), note: z.string() })),
});

const SYSTEM = `You consolidate candidate rental-housing rule records, extracted per document by another model, into one authoritative rule set for an address-level lookup tool. Query date 2026-10-01.

Granularity (important, this is scored against an answer key of roughly 58 rules across these 13 jurisdictions):
- One final rule per jurisdiction x category x distinct law (a statute section or ordinance chapter). Typical: 0-2 rules per jurisdiction-category cell.
- Fold procedural or subsidiary provisions (receipts, photos, walk-throughs, notices, interest, return deadlines, relocation amounts, eviction notice filing) into the requirement text of the headline rule they belong to. Do not output them as separate rules.
- Keep separate records only when they are different laws (e.g. local rent control vs the state cap; a local algorithmic ban vs a state law; an enacted law vs a pending bill on the same topic).
- Drop items that are not rules: motions or directives to study, informational guidance, enforcement-program descriptions.

Coverage and precedence (the engine applies these mechanically, so encode them precisely):
- Exemptions are never standalone rules. Fold them into the coverage of the rule they exempt from (e.g. a 30-year new-construction exemption from local rent control becomes age_years_exempt: 30 on that rent-control rule; when the exemption keys on construction or CO dates, set cutoff_basis accordingly).
- When a local rule covers only units NOT covered by another local rule (e.g. a just-cause ordinance for units outside rent stabilization), encode the complementary cutoff (e.g. built_after the stabilization cutoff, same cutoff_basis).
- owner_type_dependent rules MUST set owner_exemption_max_units to the largest building the owner-related exemption could possibly reach (owner-occupied duplex or two-unit exemption: 2; owner's roommate, shared kitchen/bath, single-family or condo exemption: 1; small-landlord "four units or fewer": 4). Leave it null only when owner type matters for buildings of every size.
- effective_date is when the rule first took effect, not the date of its latest amendment; put amendment dates in conflict_note.
- Use certificate_of_occupancy as cutoff_basis whenever the law keys on a certificate of occupancy or first-occupancy date.
- If a rule only covers a restricted population (subsidized/affordable units, city-funded units, program participants), set unverifiable_conditions to start with "RESTRICTED:" followed by the population.
- depends_on_unknown_fact: true only when coverage of a building turns on a fact public records lack and most otherwise-covered buildings would not meet it (restricted populations, condo conversion, demolition of protected units, program registration). False for conditions that only describe the regulated conduct (using a pricing algorithm, serving a notice, charging a fee), tenant-specific facts like length of tenancy, or narrow exemptions from an otherwise general rule.
- conflicts_with_keys is only for genuine preemption or legal conflict that supersession does not already resolve (e.g. a future state law that may preempt local ordinances). A state rule that simply yields to stricter local rules (yields_to_local) must NOT list those local rules as conflicts.
- Never take a rule's source, quote, or date from a draft, unadopted, or proposed text when an adopted source exists; take the effective date from the source you cite.
- Every distinct law among the candidates must appear in the output or in dropped with a reason.

Tasks:
1. Merge candidates describing the same legal rule (same jurisdiction, same provision) into one final rule. Pick as primary_candidate a candidate with quote_verified=true and substantive=true from the most official source (statute/ordinance text > government page > secondary). substantive=false means the quote is a heading, title, label or fragment that does not itself state the obligation, number or date; never pick it as primary when any merged candidate is substantive.
2. Never output a rule whose only support is unverified quotes; put those candidates in dropped with a reason. Drop candidates outside the six categories or outside the listed jurisdictions.
3. Fix fields using everything across the corpus: effective dates (state the conflict in conflict_note when sources disagree, e.g. Berkeley 13.63 or LA RSO formula), status (in_force / not_yet_effective / pending / failed), coverage (structured cutoffs, unit thresholds, owner-type dependence and owner_exemption_max_units), yields_to_local (state rules that by their own terms yield where local rent control / just-cause applies).
4. Model precedence and conflicts: set conflicts_with_keys on BOTH sides for possible preemption or conflicts (e.g. NJ FAIR Act P.L.2026 c.43 vs Jersey City and Hoboken algorithmic bans).
5. Keep failed measures (e.g. the struck Massachusetts rent-control ballot question) as status failed so the system can report them as not law.
6. List gaps: jurisdiction x category combinations where the corpus provides no rule (only for in-scope cities and their states).
Be exact. Do not invent rules, dates, or citations that no candidate supports.`;

function loadCandidates(): Candidate[] {
  const docs = new Map(loadCorpus().map((d) => [d.docId, d]));
  const dir = path.join(DATA, "extractions");
  const out: Candidate[] = [];
  for (const file of fs.readdirSync(dir).sort()) {
    const ex = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Extraction & { doc_id: string; url: string; retrieved_at: string };
    const doc = docs.get(ex.doc_id);
    for (const r of ex.rules) {
      const exact = doc ? locateSpan(doc.text, r.quoted_span) : null;
      out.push({
        ...r,
        quoted_span: exact ?? r.quoted_span,
        id: `c${String(out.length + 1).padStart(3, "0")}`,
        doc_id: ex.doc_id,
        source_url: ex.url,
        retrieved_at: ex.retrieved_at,
        quote_verified: exact !== null,
      });
    }
  }
  return out;
}

// The model's pick stands unless its quote is only a heading or fragment; then take the merged
// candidate with a verified, substantive quote, preferring the same document, then the longest quote.
function pickPrimary(pickedId: string, merged: string[], status: string, byId: Map<string, Candidate>): Candidate | null {
  const picked = byId.get(pickedId);
  if (picked?.quote_verified && quoteSupportsRule(picked.quoted_span, status)) return picked;
  const options = [pickedId, ...merged]
    .map((id) => byId.get(id))
    .filter((c): c is Candidate => Boolean(c?.quote_verified && quoteSupportsRule(c.quoted_span, status)))
    .sort((a, b) => Number(b.doc_id === picked?.doc_id) - Number(a.doc_id === picked?.doc_id) || b.quoted_span.length - a.quoted_span.length);
  if (options[0]) {
    console.warn(`primary ${pickedId} quote not substantive; using ${options[0].id}`);
    return options[0];
  }
  if (picked?.quote_verified) console.warn(`primary ${pickedId} quote not substantive and no alternative: ${JSON.stringify(picked.quoted_span)}`);
  return picked?.quote_verified ? picked : null;
}

function loadNoRuleFindings() {
  const dir = path.join(DATA, "extractions");
  return fs.readdirSync(dir).flatMap((file) => {
    const ex = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    return (ex.no_rule_findings ?? []).map((f: object) => ({ ...f, source_doc_id: ex.doc_id, source_url: ex.url, retrieved_at: ex.retrieved_at }));
  });
}

async function main(): Promise<void> {
  const candidates = loadCandidates();
  const verified = candidates.filter((c) => c.quote_verified).length;
  console.log(`candidates ${candidates.length}, quotes verified ${verified}`);
  writeJson(path.join(DATA, "candidates.json"), candidates);

  const compact = candidates.map(({ quoted_span, requirement, ...c }) => ({
    ...c,
    requirement: requirement.slice(0, 300),
    quote: quoted_span.slice(0, 400),
    substantive: quoteSupportsRule(quoted_span, c.status),
  }));
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 128000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(ConsolidatedSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Candidates (${candidates.length}):\n${JSON.stringify(compact)}\n\nNo-rule findings:\n${JSON.stringify(loadNoRuleFindings())}` }],
  });
  const message = await stream.finalMessage();
  if (!message.parsed_output) throw new Error(`no parsed output (stop_reason ${message.stop_reason})`);
  const result = message.parsed_output;
  writeJson(path.join(DATA, "consolidation.json"), result);

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const keyToId = new Map<string, string>();
  const sorted = [...result.rules].sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || a.category.localeCompare(b.category));
  sorted.forEach((r, i) => keyToId.set(r.key, `r-${String(i + 1).padStart(4, "0")}`));

  const groups: Record<string, string[]> = {};
  const rules: Rule[] = sorted.flatMap((r) => {
    const primary = pickPrimary(r.primary_candidate, r.merged_candidates, r.status, byId);
    if (!primary) {
      console.warn(`skip ${r.key}: primary ${r.primary_candidate} not verified`);
      return [];
    }
    groups[keyToId.get(r.key)!] = [...new Set([r.primary_candidate, ...r.merged_candidates])];
    const conflicts = r.conflicts_with_keys.map((k) => keyToId.get(k)).filter((x): x is string => Boolean(x));
    return [
      {
        team_rule_id: keyToId.get(r.key)!,
        jurisdiction: r.jurisdiction,
        level: r.level,
        category: r.category,
        status: r.status,
        title: r.title,
        requirement: r.requirement,
        key_value: r.key_value,
        coverage_conditions: r.coverage_conditions,
        exemptions: r.exemptions,
        coverage: r.coverage,
        yields_to_local: r.yields_to_local,
        overrides: [],
        interaction: r.yields_to_local ? "Yields to a stricter local rule in the same category where one covers the unit." : null,
        effective_date: r.effective_date,
        citation: r.citation,
        source_doc_id: primary.doc_id,
        source_url: primary.source_url,
        retrieved_at: primary.retrieved_at,
        quoted_span: primary.quoted_span,
        confidence: r.confidence,
        conflict_flag: conflicts.length > 0,
        conflict_note: r.conflict_note,
        conflicts_with: conflicts,
      },
    ];
  });

  writeJson(path.join(DATA, "rules.json"), rules);
  writeJson(path.join(DATA, "rule-groups.json"), groups);
  writeJson(path.join(ROOT, "src/data/rules.json"), rules);
  writeJson(path.join(DATA, "no_rule_findings.json"), loadNoRuleFindings());
  writeJson(path.join(DATA, "gaps.json"), result.gaps);
  console.log(`final rules ${rules.length}, dropped ${result.dropped.length}, gaps ${result.gaps.length}`);
  for (const j of JURISDICTIONS) console.log(j.padEnd(18), CATEGORIES.map((c) => rules.filter((r) => r.jurisdiction === j && r.category === c).length).join(" "));
}

await main();
