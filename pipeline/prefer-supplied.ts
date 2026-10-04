import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, STARTER, parseCsv, writeJson } from "./lib/corpus";
import { quoteSupportsRule } from "../src/lib/extraction";
import type { Rule } from "../src/lib/types";

// The citation metric counts only the organizer-supplied corpus text (RealPage, Discord 2026-10-03).
// For each rule whose chosen source is a page we captured ourselves, switch to a verified candidate from a
// supplied document whose quote substantively supports the same rule (longest first). A rule whose quote is
// only a heading switches to any substantive candidate, captured or not. Rules with no supplied support keep
// the captured source and are marked so the UI and method note can say so.
interface Candidate {
  id: string;
  doc_id: string;
  source_url: string;
  retrieved_at: string;
  quoted_span: string;
  quote_verified: boolean;
}

const longestFirst = (a: Candidate, b: Candidate) => b.quoted_span.length - a.quoted_span.length;

function main(): void {
  const supplied = new Set(
    parseCsv(fs.readFileSync(path.join(STARTER, "corpus/corpus_manifest.csv"), "utf8"))
      .filter((r) => r.text_file)
      .map((r) => r.doc_id),
  );
  const rules: Rule[] = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
  const candidates = new Map((JSON.parse(fs.readFileSync(path.join(DATA, "candidates.json"), "utf8")) as Candidate[]).map((c) => [c.id, c]));
  const groups: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(DATA, "rule-groups.json"), "utf8"));

  let switched = 0;
  let capturedOnly = 0;
  const out = rules.map((rule) => {
    const supportive = (groups[rule.team_rule_id] ?? [])
      .map((id) => candidates.get(id))
      .filter((c): c is Candidate => Boolean(c?.quote_verified && quoteSupportsRule(c.quoted_span, rule.status)));
    const currentOk = quoteSupportsRule(rule.quoted_span, rule.status);
    const currentSupplied = !rule.source_doc_id || supplied.has(rule.source_doc_id);
    if (currentSupplied && currentOk) return { ...rule, source_in_supplied_corpus: true };
    const alt = supportive.filter((c) => supplied.has(c.doc_id)).sort(longestFirst)[0] ?? (currentOk ? undefined : [...supportive].sort(longestFirst)[0]);
    if (!alt) {
      if (!currentOk) console.warn(`  no substantive quote for ${rule.team_rule_id}: ${JSON.stringify(rule.quoted_span)}`);
      if (!currentSupplied) capturedOnly++;
      return { ...rule, source_in_supplied_corpus: currentSupplied };
    }
    switched++;
    const inSupplied = supplied.has(alt.doc_id);
    if (!inSupplied) capturedOnly++;
    return {
      ...rule,
      source_doc_id: alt.doc_id,
      source_url: alt.source_url,
      retrieved_at: alt.retrieved_at,
      quoted_span: alt.quoted_span,
      source_in_supplied_corpus: inSupplied,
    };
  });

  writeJson(path.join(DATA, "rules.json"), out);
  writeJson(path.join(ROOT, "src/data/rules.json"), out);
  console.log(`switched source: ${switched}; captured-only (kept, marked): ${capturedOnly}`);
  for (const r of out.filter((x) => !x.source_in_supplied_corpus)) console.log(`  captured-only ${r.team_rule_id} ${r.source_doc_id} ${r.title}`);
}

main();
