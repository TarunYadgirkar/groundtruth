import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, loadCorpus, writeJson, type CorpusDoc } from "./lib/corpus";
import { locateSpan } from "../src/lib/extraction";
import type { Rule, ScheduledValue } from "../src/lib/types";

// Extracted quotes sometimes stop mid-sentence ("...no earlier than"). This deterministic pass finds each
// quote in its source and extends it to the sentence end (and, when it starts lowercase mid-sentence, back to
// the sentence start). The result is always an exact slice of the source. Quotes that end in a figure, in
// punctuation, or that are a whole line followed by a new capitalised line (bill titles, rate lines) are left alone.
const MAX_EXTEND = 400;
const SENTENCE_END = /[.;](?=["”’)]?(\s|$))["”’)]?/g;
const BLANK_LINE = /\n[ \t]*\n/g;
const LIST_MARKER = /^\(?[a-z0-9]{1,3}[.)]\s/i;

const endsMidSentence = (span: string) => /[A-Za-z]$/.test(span);

function isWholeLine(text: string, start: number, end: number): boolean {
  const span = text.slice(start, end);
  const nextLine = text.slice(end + 1, end + 2);
  return !span.includes("\n") && (start === 0 || text[start - 1] === "\n") && (end === text.length || (text[end] === "\n" && !/[a-z]/.test(nextLine)));
}

function firstMatchEnd(re: RegExp, s: string): number {
  re.lastIndex = 0;
  const m = re.exec(s);
  return m ? m.index + m[0].length : -1;
}

function forwardEnd(text: string, end: number): number | null {
  const tail = text.slice(end, end + MAX_EXTEND);
  const stop = firstMatchEnd(SENTENCE_END, tail);
  if (stop < 0) return null;
  BLANK_LINE.lastIndex = 0;
  const blank = BLANK_LINE.exec(tail);
  if (blank && blank.index < stop) return null;
  return end + stop;
}

function backwardStart(text: string, start: number): number {
  const span = text.slice(start, start + 20);
  if (!/^[a-z]/.test(span) || LIST_MARKER.test(span)) return start;
  const head = text.slice(Math.max(0, start - MAX_EXTEND), start);
  let cut = -1;
  for (const re of [SENTENCE_END, BLANK_LINE]) {
    re.lastIndex = 0;
    for (let m = re.exec(head); m; m = re.exec(head)) cut = Math.max(cut, m.index + m[0].length);
  }
  if (cut < 0) return start;
  const skip = head.slice(cut).match(/^[\s●•▪◦]*/)?.[0].length ?? 0;
  return start - head.length + cut + skip;
}

function complete(quote: string, doc: CorpusDoc | undefined): string {
  if (!doc || !endsMidSentence(quote)) return quote;
  const span = locateSpan(doc.text, quote);
  if (!span) return quote;
  const start = doc.text.indexOf(span);
  const end = start + span.length;
  if (isWholeLine(doc.text, start, end)) return quote;
  const newEnd = forwardEnd(doc.text, end);
  if (newEnd === null) return quote;
  const out = doc.text.slice(backwardStart(doc.text, start), newEnd);
  return locateSpan(doc.text, out) === out ? out : quote;
}

function main(): void {
  const rules: Rule[] = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
  const docs = new Map(loadCorpus().map((d) => [d.docId, d]));
  const changed: string[] = [];
  const report = (id: string, before: string, after: string) => {
    if (before === after) return;
    changed.push(id);
    console.log(`\n${id}\n  before: ${JSON.stringify(before)}\n  after:  ${JSON.stringify(after)}`);
  };
  const out = rules.map((rule) => {
    const quoted_span = complete(rule.quoted_span, docs.get(rule.source_doc_id));
    report(rule.team_rule_id, rule.quoted_span, quoted_span);
    const value_schedule = rule.value_schedule?.map((e, i): ScheduledValue => {
      const q = complete(e.quoted_span, docs.get(e.source_doc_id ?? rule.source_doc_id));
      report(`${rule.team_rule_id} schedule[${i}]`, e.quoted_span, q);
      return { ...e, quoted_span: q };
    });
    return value_schedule ? { ...rule, quoted_span, value_schedule } : { ...rule, quoted_span };
  });
  writeJson(path.join(DATA, "rules.json"), out);
  writeJson(path.join(ROOT, "src/data/rules.json"), out);
  console.log(`\ncompleted ${changed.length} quotes`);
}

main();
