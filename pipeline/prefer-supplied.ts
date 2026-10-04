import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, STARTER, parseCsv, writeJson } from "./lib/corpus";
import type { Rule } from "../src/lib/types";

// The citation metric counts only the organizer-supplied corpus text (RealPage, Discord 2026-10-03).
// For each rule whose chosen source is a page we captured ourselves, switch to a verified candidate from a
// supplied document when one supports the same rule. Rules with no supplied support keep the captured
// source and are marked so the UI and method note can say so.
interface Candidate {
  id: string;
  doc_id: string;
  source_url: string;
  retrieved_at: string;
  quoted_span: string;
  citation: string;
  quote_verified: boolean;
}

interface Consolidated {
  primary_candidate: string;
  merged_candidates: string[];
  title: string;
}

function main(): void {
  const supplied = new Set(
    parseCsv(fs.readFileSync(path.join(STARTER, "corpus/corpus_manifest.csv"), "utf8"))
      .filter((r) => r.text_file)
      .map((r) => r.doc_id),
  );
  const rules: Rule[] = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
  const candidates = new Map((JSON.parse(fs.readFileSync(path.join(DATA, "candidates.json"), "utf8")) as Candidate[]).map((c) => [c.id, c]));
  const groups: Consolidated[] = JSON.parse(fs.readFileSync(path.join(DATA, "consolidation.json"), "utf8")).rules;

  let switched = 0;
  let capturedOnly = 0;
  const out = rules.map((rule) => {
    if (!rule.source_doc_id || supplied.has(rule.source_doc_id)) return { ...rule, source_in_supplied_corpus: true };
    const group = groups.find((g) => g.title === rule.title && candidates.get(g.primary_candidate)?.doc_id === rule.source_doc_id);
    const alt = group?.merged_candidates.map((id) => candidates.get(id)).find((c) => c && c.quote_verified && supplied.has(c.doc_id));
    if (!alt) {
      capturedOnly++;
      return { ...rule, source_in_supplied_corpus: false };
    }
    switched++;
    return {
      ...rule,
      source_doc_id: alt.doc_id,
      source_url: alt.source_url,
      retrieved_at: alt.retrieved_at,
      quoted_span: alt.quoted_span,
      source_in_supplied_corpus: true,
    };
  });

  writeJson(path.join(DATA, "rules.json"), out);
  writeJson(path.join(ROOT, "src/data/rules.json"), out);
  console.log(`switched to supplied source: ${switched}; captured-only (kept, marked): ${capturedOnly}`);
  for (const r of out.filter((x) => !x.source_in_supplied_corpus)) console.log(`  captured-only ${r.team_rule_id} ${r.source_doc_id} ${r.title}`);
}

main();
