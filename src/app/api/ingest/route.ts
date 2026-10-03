import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ADDRESSES, RULES } from "@/lib/data";
import { EXTRACTION_SYSTEM, ExtractionSchema } from "@/lib/extraction";
import { affectedAddresses, toRules, type IngestResult } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-opus-5-5";
const MAX_CHARS = 60_000;
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 4;
const MAX_GLOBAL_PER_WINDOW = 30;
const hits = new Map<string, number[]>();
let globalHits: number[] = [];

const IngestRequest = z.object({
  text: z.string().min(200).max(MAX_CHARS),
  title: z.string().max(200).optional(),
  source_url: z.string().url().max(500).optional(),
});

function rateLimited(ip: string): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.set(ip, [...recent, now]);
  globalHits = [...globalHits, now];
  return recent.length >= MAX_PER_WINDOW || globalHits.length > MAX_GLOBAL_PER_WINDOW;
}

function clientIp(request: Request): string {
  return request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Document reading isn't configured on this deployment." }, { status: 503 });
  if (!sameOrigin(request)) return Response.json({ error: "Requests must come from this site." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CHARS * 4) return Response.json({ error: "That document is too large. Paste up to 60,000 characters." }, { status: 413 });
  if (rateLimited(clientIp(request))) return Response.json({ error: "Too many documents in a few minutes. Wait a bit and try again." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the document as JSON." }, { status: 400 });
  }
  const parsed = IngestRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Paste between 200 and 60,000 characters of law text." }, { status: 400 });

  const { text, title, source_url } = parsed.data;
  const label = source_url ?? `Pasted document${title ? `: ${title}` : ""}`;
  const retrievedAt = new Date().toISOString();

  const client = new Anthropic({ apiKey, maxRetries: 4 });
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema) },
      system: [{ type: "text", text: EXTRACTION_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `doc_id: NEW\njurisdiction tag: (infer from the document)\nsource_type: user-supplied document\nurl: ${label}\nretrieved_at: ${retrievedAt}\n\n<document>\n${text}\n</document>`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (!message.parsed_output) return Response.json({ error: "The document couldn't be read into rules. Try a cleaner copy of the text." }, { status: 422 });

    const { rules, dropped } = toRules(message.parsed_output, text, label, retrievedAt);
    const result: IngestResult = { rules, dropped, ...affectedAddresses(rules, RULES, ADDRESSES) };
    return Response.json(result);
  } catch (error) {
    console.error("ingest failed", error);
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "The reader is busy. Try again in a minute." }, { status: 429 });
    return Response.json({ error: "Reading the document failed. Try again." }, { status: 502 });
  }
}
