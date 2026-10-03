import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DATA, loadCorpus, writeJson, type CorpusDoc } from "./lib/corpus";
import { ExtractionSchema, JURISDICTIONS, CATEGORIES, type Extraction } from "./lib/schema";

const MODEL = "claude-opus-5-5";
const CONCURRENCY = 8;
const OUT_DIR = path.join(DATA, "extractions");

const client = new Anthropic();

const SYSTEM = `You extract U.S. rental housing rules from one source document into structured records for an address-level law lookup tool.

Scope: 3 states (CA, NJ, MA) and these jurisdictions only: ${JURISDICTIONS.join("; ")}.
Six categories only: ${CATEGORIES.join(", ")}.
Query date: 2026-10-01.

How to extract:
- One record per distinct legal rule the document states or describes (a cap, a ban, a required cause, a fee limit, a screening restriction). Split a statute into separate records when it creates rules in different categories.
- Include rules that are enacted but not yet effective (status not_yet_effective), pending bills (pending), and failed/struck measures (failed) when the document describes them.
- Secondary or summary pages count: if a city web page describes a city ordinance, extract the ordinance with its official citation when the page gives one.
- quoted_span must be copied EXACTLY from the document text, character for character, contiguous, 1-3 sentences. Never paraphrase, never stitch fragments together, never fix typos. If the supporting text spans a table or list, copy one contiguous line that supports the rule.
- Coverage: fill the structured coverage block precisely. Use certificate_of_occupancy when the law keys on a certificate of occupancy or "first occupied" date, year_built only when it keys on construction date. Leave fields null when the document does not state them. Do not invent cutoffs.
- yields_to_local: true for state rules that by their own terms do not apply where stricter local rent control / just-cause rules apply (e.g. Cal. Civ. Code 1947.12 and 1946.2 carve-outs).
- effective_date: use the date the document states. If it only shows enactment (e.g. a chaptered California bill), apply the state's default effective-date rule (California regular-session statutes: January 1 of the following year; urgency statutes: on signing) and say so in conflict_note with confidence <= 0.8.
- Record conflicting effective dates or possible preemption in conflict_note and lower confidence.
- If the document is irrelevant to the six categories, return empty arrays.
- no_rule_findings: explicit statements that no rule exists at a level (e.g. Massachusetts bars local rent control; a ballot question was struck).
Never invent rules, citations, or dates that the document does not support.`;

async function extractDoc(doc: CorpusDoc): Promise<Extraction> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `doc_id: ${doc.docId}\njurisdiction tag: ${doc.jurisdictions}\nsource_type: ${doc.sourceType}\nurl: ${doc.url}\nretrieved_at: ${doc.retrievedAt}\n\n<document>\n${doc.text}\n</document>`,
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason !== "end_turn") throw new Error(`${doc.docId}: stop_reason ${message.stop_reason}`);
  if (!message.parsed_output) throw new Error(`${doc.docId}: no parsed output`);
  return message.parsed_output;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) await worker(item);
    }),
  );
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const force = only.includes("--force");
  const ids = only.filter((a) => !a.startsWith("--"));
  const docs = loadCorpus().filter((d) => ids.length === 0 || ids.includes(d.docId));
  const failures: string[] = [];

  await runPool(docs, CONCURRENCY, async (doc) => {
    const file = path.join(OUT_DIR, `${doc.docId}.json`);
    if (!force && fs.existsSync(file)) return;
    const started = Date.now();
    try {
      const result = await extractDoc(doc);
      writeJson(file, { doc_id: doc.docId, url: doc.url, retrieved_at: doc.retrievedAt, model: MODEL, ...result });
      console.log(`${doc.docId} ${result.rules.length} rules ${((Date.now() - started) / 1000).toFixed(0)}s`);
    } catch (error) {
      failures.push(doc.docId);
      console.error(`${doc.docId} FAILED`, error instanceof Error ? error.message : error);
    }
  });

  if (failures.length) {
    console.error(`failed: ${failures.join(" ")}`);
    process.exitCode = 1;
  }
}

await main();
