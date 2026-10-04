import { clientIp, rateLimiter, sameOrigin } from "@/lib/api-guard";
import { ResearchRequest, type ResearchEvent } from "@/lib/live-research";
import { cacheKey, cachedResearch, research } from "@/lib/research";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BODY_BYTES = 2_000;
const rateLimited = rateLimiter({ windowMs: 10 * 60_000, perIp: 4, global: 30 });

const line = (event: ResearchEvent) => new TextEncoder().encode(`${JSON.stringify(event)}\n`);

function ndjson(run: (send: (e: ResearchEvent) => void) => Promise<void>): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      // A closed tab shouldn't stop the run; the result still lands in the cache for the next visit.
      const send = (e: ResearchEvent) => {
        if (!open) return;
        try {
          controller.enqueue(line(e));
        } catch {
          open = false;
        }
      };
      await run(send);
      if (open) controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Live research isn't configured on this deployment." }, { status: 503 });
  if (!sameOrigin(request)) return Response.json({ error: "Requests must come from this site." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return Response.json({ error: "That request is too large." }, { status: 413 });

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "That request is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Send the city and state as JSON." }, { status: 400 });
  }
  const parsed = ResearchRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "That city or state couldn't be read." }, { status: 400 });

  const req = parsed.data;
  const hit = await cachedResearch(cacheKey(req));
  if (hit) return ndjson(async (send) => send({ type: "result", result: hit }));

  if (rateLimited(clientIp(request))) return Response.json({ error: "Live research is limited to a few cities every 10 minutes. Try again shortly." }, { status: 429 });

  return ndjson(async (send) => {
    try {
      const result = await research(req, (stage, pages) => send({ type: "stage", stage, pages }));
      send({ type: "result", result });
    } catch (err) {
      console.error("research route failed", err);
      send({ type: "error", message: "Live research didn't finish." });
    }
  });
}
