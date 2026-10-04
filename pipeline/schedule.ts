import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DATA, ROOT, loadCorpus, writeJson, type CorpusDoc } from "./lib/corpus";
import { locateSpan } from "../src/lib/extraction";
import { DEFAULT_AS_OF, valueAt } from "../src/lib/engine";
import type { Rule, ScheduledValue } from "../src/lib/types";

// Dated values (annual allowable increases, deposit interest rates, relocation amounts by fiscal year)
// become a value_schedule so the as-of date picks the right figure. Every entry's quote is verified
// verbatim against its document and must contain the figure it reports.
const MODEL = "claude-opus-5-5";
const CONCURRENCY = 6;
const MAX_DOC_CHARS = 40_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const client = new Anthropic({ maxRetries: 8 });

const ScheduleOut = z.object({
  entries: z.array(
    z.object({
      from: z.string().nullable().describe("First day the value applies, YYYY-MM-DD, or null if the document gives no start"),
      to: z.string().nullable().describe("Last day the value applies (inclusive), YYYY-MM-DD, or null if open-ended"),
      value: z.string().describe("The figure for that period, short, e.g. '1.6%' or '$8,245 per tenant'"),
      quoted_span: z.string().describe("EXACT contiguous text from the document that states this figure for this period (include the dates when they are adjacent)"),
      doc_id: z.string(),
    }),
  ),
});

const SYSTEM = `You find dated values of one rental-housing rule's headline figure in its source documents.

Return one entry per period for which a document explicitly ties the rule's figure to a date interval: annual allowable rent increases, security-deposit interest rates, relocation amounts per fiscal year, CPI-adjusted fee caps per year. Include past and future periods the documents state.
- from/to: inclusive ISO dates. "March 1, 2026 - February 28, 2027" -> from 2026-03-01, to 2027-02-28. "Effective July 1, 2026" with no end -> from 2026-07-01, to null. "for 2025" -> 2025-01-01 / 2025-12-31.
- value: the figure only (with its unit), matching the rule's key value style.
- quoted_span: copied character for character from the named document, contiguous, containing the figure. Never paraphrase.
- Only figures for THIS rule (e.g. for a rent-increase rule, not deposit interest or registration fees).
- Return an empty list when the figure is fixed by statute (e.g. "5% + CPI, max 10%", "1 month's rent", "$50 max") or no document dates it. Never invent values or dates.`;

const numbers = (s: string) => s.match(/\d[\d,]*(\.\d+)?/g) ?? [];

function verifyEntry(e: z.infer<typeof ScheduleOut>["entries"][number], docs: Map<string, CorpusDoc>): ScheduledValue | null {
  const doc = docs.get(e.doc_id);
  if (!doc) return null;
  if ((e.from && !ISO.test(e.from)) || (e.to && !ISO.test(e.to)) || (!e.from && !e.to)) return null;
  const span = locateSpan(doc.text, e.quoted_span);
  if (!span) return null;
  const flat = span.replace(/\s+/g, " ");
  if (!numbers(e.value).every((n) => flat.includes(n))) return null;
  return { from: e.from, to: e.to, value: e.value, quoted_span: span, source_doc_id: doc.docId };
}

async function scheduleFor(rule: Rule, docs: CorpusDoc[]): Promise<ScheduledValue[]> {
  const body = docs.map((d) => `<document doc_id="${d.docId}" url="${d.url}">\n${d.text.slice(0, MAX_DOC_CHARS)}\n</document>`).join("\n\n");
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(ScheduleOut) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Rule ${rule.team_rule_id} (${rule.jurisdiction}): ${rule.title}\nRequirement: ${rule.requirement}\nKey value: ${rule.key_value}\nCitation: ${rule.citation}\n\n${body}`,
      },
    ],
  });
  const message = await stream.finalMessage();
  const out = message.parsed_output;
  if (!out) throw new Error(`${rule.team_rule_id}: no parsed output (${message.stop_reason})`);
  const byId = new Map(docs.map((d) => [d.docId, d]));
  const kept = out.entries.map((e) => verifyEntry(e, byId)).filter((e): e is ScheduledValue => e !== null);
  const dropped = out.entries.length - kept.length;
  if (dropped) console.warn(`${rule.team_rule_id}: dropped ${dropped} unverified entries`);
  return kept.sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await worker(item);
  }));
}

function currentKeyValue(rule: Rule, schedule: ScheduledValue[]): string | null {
  const now = valueAt({ key_value: rule.key_value, value_schedule: schedule }, DEFAULT_AS_OF).entry;
  if (!now || !rule.key_value || numbers(now.value).every((n) => rule.key_value!.includes(n))) return rule.key_value;
  const range = `${now.from ?? "…"} to ${now.to ?? "…"}`;
  console.warn(`${rule.team_rule_id}: key_value "${rule.key_value}" -> "${now.value} (${range})"`);
  return `${now.value} (${range})`;
}

async function main(): Promise<void> {
  const rules: Rule[] = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
  const groups: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(DATA, "rule-groups.json"), "utf8"));
  const candidates = new Map((JSON.parse(fs.readFileSync(path.join(DATA, "candidates.json"), "utf8")) as { id: string; doc_id: string }[]).map((c) => [c.id, c.doc_id]));
  const corpus = new Map(loadCorpus().map((d) => [d.docId, d]));

  const schedules = new Map<string, ScheduledValue[]>();
  const targets = rules.filter((r) => r.key_value && /\d/.test(r.key_value) && (r.status === "in_force" || r.status === "not_yet_effective"));
  await runPool(targets, CONCURRENCY, async (rule) => {
    const ids = new Set([rule.source_doc_id, ...(groups[rule.team_rule_id] ?? []).map((c) => candidates.get(c))].filter((x): x is string => Boolean(x)));
    const docs = [...ids].map((id) => corpus.get(id)).filter((d): d is CorpusDoc => Boolean(d));
    try {
      const schedule = await scheduleFor(rule, docs);
      if (schedule.length) schedules.set(rule.team_rule_id, schedule);
      console.log(`${rule.team_rule_id} ${schedule.length} dated values ${schedule.map((e) => `${e.value}@${e.from}..${e.to}`).join("; ")}`);
    } catch (error) {
      console.error(`${rule.team_rule_id} FAILED`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

  const out = rules.map((rule) => {
    const schedule = schedules.get(rule.team_rule_id);
    return schedule ? { ...rule, key_value: currentKeyValue(rule, schedule), value_schedule: schedule } : { ...rule, value_schedule: undefined };
  });
  writeJson(path.join(DATA, "rules.json"), out);
  writeJson(path.join(ROOT, "src/data/rules.json"), out);
  console.log(`rules with value_schedule: ${schedules.size}`);
}

await main();
