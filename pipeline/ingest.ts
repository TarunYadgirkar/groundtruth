import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DATA, writeJson } from "./lib/corpus";
import { EXTRACTION_SYSTEM, ExtractionSchema } from "../src/lib/extraction";
import { affectedAddresses, toRules } from "../src/lib/ingest";
import type { Address, Rule } from "../src/lib/types";

// Usage: npx tsx pipeline/ingest.ts path/to/new-law.txt
// Runs a new document through the same extraction + quote verification + engine, and reports affected addresses.
async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx pipeline/ingest.ts <document.txt>");
  const text = fs.readFileSync(file, "utf8");
  const retrievedAt = new Date().toISOString();
  const client = new Anthropic({ maxRetries: 6 });
  const message = await client.messages
    .stream({
      model: "claude-opus-5-5",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema) },
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: `doc_id: NEW\nurl: ${path.basename(file)}\nretrieved_at: ${retrievedAt}\n\n<document>\n${text}\n</document>` }],
    })
    .finalMessage();
  if (!message.parsed_output) throw new Error(`no parsed output (${message.stop_reason})`);

  const rules: Rule[] = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
  const addresses: Address[] = JSON.parse(fs.readFileSync(path.join(DATA, "addresses.json"), "utf8"));
  const extracted = toRules(message.parsed_output, text, path.basename(file), retrievedAt);
  const impact = affectedAddresses(extracted.rules, rules, addresses);
  const out = path.join(DATA, "ingest", `${path.basename(file, path.extname(file))}.json`);
  writeJson(out, { ...extracted, ...impact });

  for (const r of extracted.rules) console.log(`${r.team_rule_id} ${r.jurisdiction} ${r.category} ${r.status} eff ${r.effective_date} :: ${r.title}`);
  for (const d of extracted.dropped) console.log(`dropped: ${d.title} (${d.reason})`);
  console.log(`affected ${impact.affected_count}/${impact.total_addresses} (as of ${impact.as_of} → ${impact.after_date}); written ${path.relative(process.cwd(), out)}`);
}

await main();
