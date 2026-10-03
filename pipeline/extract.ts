import "./lib/env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DATA, loadCorpus, writeJson, type CorpusDoc } from "./lib/corpus";
import { EXTRACTION_SYSTEM as SYSTEM, ExtractionSchema, type Extraction } from "../src/lib/extraction";

const MODEL = "claude-opus-5-5";
const CONCURRENCY = 4;
const OUT_DIR = path.join(DATA, "extractions");

const client = new Anthropic({ maxRetries: 8 });


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

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      const retryable = error instanceof Anthropic.APIError && (error.status === undefined || error.status >= 500 || error.status === 429);
      if (!retryable || i >= attempts) throw error;
      const wait = 5000 * 2 ** (i - 1);
      console.warn(`${label} retry ${i} in ${wait / 1000}s: ${error.message.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
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
      const result = await withRetry(() => extractDoc(doc), doc.docId);
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
