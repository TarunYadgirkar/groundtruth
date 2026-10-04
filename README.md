# Groundtruth

**Which rental housing laws apply at this address, on any date.**

Groundtruth reads state and city housing law, turns it into structured rules with verbatim citations, resolves an apartment address to its legal jurisdiction, and decides which rules apply to that building on any date: applies, unknown, superseded, not yet effective, or pending. You type an address, the camera flies from orbit down to the building in Google's photorealistic 3D, and every applicable rule appears with the exact source text it rests on. Drag the date slider and the answers change as laws take effect.

Built for the RealPage "Rental Housing Law Navigator" challenge at Hack-Nation's 7th Global AI Hackathon (Oct 3–4, 2026).

> Not legal advice. Every answer links to the source text and retrieval date it rests on. Rules have not been reviewed by counsel.

## What it does

| Module | How |
|---|---|
| **A · Extract** | Claude (`claude-opus-5-5`, structured outputs) reads each corpus document and emits rule records in the challenge schema plus a machine-checkable coverage block. Every `quoted_span` is checked verbatim against the source text; rules whose quote can't be found are dropped. A consolidation pass merges duplicates across documents, settles effective dates and precedence, and records conflicts. |
| **B · Resolve and apply** | Addresses are geocoded with the Census Geocoder (batch, then cleaned one-line retries, then Google) and placed in their legal city with Census incorporated-place boundaries, so "Dorchester" resolves to Boston. A deterministic engine (`src/lib/engine.ts`, no AI) tests each rule's coverage against year built, unit count (record or assessor use code), certificate-of-occupancy cutoffs, owner-type dependence, and restricted programs, then applies state-versus-local precedence. Missing facts produce `unknown`, never a guess. |
| **C · Track change** | The same engine runs at any as-of date. `submission/changes.json` holds T1–T5 with affected addresses, conflict flags and before/after results. `/new-law` (and `pipeline/ingest.ts`) runs a never-seen document through extraction, verification and the engine and lists the buildings it affects. |

## Try it

- Type a sample address (e.g. `6238 De Longpre Ave`, `1031 Clinton St, Hoboken`, `63 Bailey St, Dorchester`) or any address in CA, NJ or MA. Addresses outside the sample get statewide rules plus city rules for the 10 covered cities, and you can add year built and unit count to resolve unknowns.
- Drag the date slider, or click 2026-01-02 or 2027-07-02, to watch T1 and T3 happen.
- Ask: "My landlord wants to raise my rent 10% next month. Is that allowed?"
- `/new-law` → "Try the sample" runs a fictional ordinance end to end.
- Live research (beta): for a CA, NJ or MA city outside the corpus (e.g. Oakland, Somerville, Trenton), or an address in another state (e.g. Austin, TX), click "Research <city> law live". Claude searches and fetches official code sites (3 searches, 5 fetches), returns rule records, and the server keeps only rules whose quote appears verbatim in the page text the fetch tool actually returned. The engine then applies them to the building. Results take about 30 to 50 s, are cached per city for 24 h, and appear in a separate amber section that is never counted in the totals.

> Live research caveat: those rules are found on the open web at click time. A verified quote proves the text is on that page, not that the page is current, complete or official, and nothing there has been audited like the corpus. They are never written to `submission/`. Scored outputs stay corpus-only.

## Deliverables

- `submission/rules.json`: 56 rule records (schema in `starter/schema/rule_record.schema.json`)
- `submission/lookups.json`: results for all 500 sample addresses as of 2026-10-01
- `submission/changes.json`: T1–T5
- `METHOD.md`: one-page method note, accuracy audit and limitations

## Run it

Requirements: Node 20+, pnpm, an Anthropic API key, and a Google Maps Platform key with the Maps JavaScript API (3D Maps), Geocoding and Places enabled.

```bash
pnpm install
cp .env.example .env.local   # then fill in both keys
pnpm dev                     # http://localhost:3000
```

Rebuild the data from the starter pack:

```bash
npx tsx pipeline/extract.ts       # Module A: per-document extraction (data/extractions/)
npx tsx pipeline/consolidate.ts   # verify quotes, merge, precedence -> data/rules.json
npx tsx pipeline/geocode.ts       # Module B: legal jurisdiction for 500 addresses
npx tsx pipeline/submit.ts        # rules.json, lookups.json, changes.json -> submission/
npx tsx pipeline/ingest.ts path/to/new-law.txt   # run a new document end to end
```

`pipeline/capture.ts` fetches the starter pack's link-only sources one page at a time, with retrieval dates recorded. The RealPage organizer confirmed in the event Discord that teams may capture link-only pages. Sites that refused automated access were not captured.

## Layout

```
pipeline/          extraction, capture, consolidation, geocoding, submission, ingest
src/lib/engine.ts  deterministic coverage + precedence engine (shared by pipeline and UI)
src/lib/extraction.ts  extraction schema, prompt, verbatim quote locator
src/app/           Next.js app: landing, 3D fly-in, answer panel, /changes, /new-law, /method
                   API: /api/ask (grounded Q&A), /api/ingest (new law), /api/place (Census legal city), /api/normalize (messy-address cleanup), /api/research (live research, beta)
scripts/           verify-addresses.mjs (headless check of all 500 sample addresses)
data/              intermediate outputs (extractions, candidates, consolidation, audit)
submission/        challenge deliverables
starter/           organizer starter pack (unchanged)
```

## Stack

Next.js 16, TypeScript, Tailwind v4, Motion, Google Maps JavaScript 3D Maps (photorealistic tiles), Census Geocoder, Anthropic Claude Opus 5.5 (server-side only), Zod.

## License

MIT
