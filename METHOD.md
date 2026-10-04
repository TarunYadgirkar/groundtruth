# Groundtruth: method note

**Question answered:** for each sample address, which rental housing rules apply on the query date, and how do the supplied change cases affect the answer? Each rule shown carries verbatim source text and a retrieval date. Not legal advice.

## Pipeline

Order: capture (permitted link-only pages) → extract → consolidate → prefer-supplied → schedule → complete-quotes → geocode → rooftop → zips → submit.

1. **Corpus and capture.** The starter manifest has 87 entries: 54 with supplied text and 33 link-only. We used all 54 supplied texts, plus captured link-only pages (19 files covering 17 of the 33 when this note was written), fetched one page at a time with recorded retrieval dates. They are law-firm, news and legislature pages, including the WBUR report on the struck Massachusetts ballot question, the Hoboken and Jersey City ban coverage, and official Hoboken and Newark rent-control PDFs (Hoboken Chapter 155 regulations and CPI sheet, Newark Division of Rent Control FAQ) used in place of their ecode360 pages. The RealPage organizer confirmed in the event Discord that capturing link-only pages is allowed. Publisher sites that refused automated access (ecode360, Justia, American Legal) were not captured, and we did not bulk-scrape anything.
2. **Extraction (Module A, automated).** Claude Opus 5.5 reads each document whole (no chunking) with a fixed prompt and returns structured output that is validated against a Zod schema. That schema is the challenge's rule schema plus a machine-checkable coverage block: unit limits, built-before and built-after cutoffs, whether the cutoff is a construction or certificate-of-occupancy date, rolling new-construction exemptions, owner-type dependence with the largest building the owner exemption can reach, and rules limited to specific programs. 73 documents produced 206 candidate rules.
3. **Quote verification.** Each `quoted_span` must appear in its source document. Whitespace and quote style are normalized for the search, and the exact original text is stored. 206 of 206 candidate quotes matched verbatim. Quotes must state the obligation, figure or date; a heading alone is rejected. A rule whose quote can't be found is not used.
4. **Consolidation.** A second Claude pass sees all candidates. It merges the same law cited by several documents, keeping the most official verified source. It folds exemptions and procedural sub-rules into their headline rule, and sets effective dates, statuses (`in_force`, `not_yet_effective`, `pending`, `failed`), state-yields-to-local precedence, and genuine preemption conflicts. The result is **59 rules**. Each one traces back to the candidates and documents it came from (`data/consolidation.json`).
5. **Citation preference (`pipeline/prefer-supplied.ts`).** Captured pages do not count toward the challenge citation metric, so a rule that cites a captured page is switched to supplied-corpus text where a verified supplied quote supports it. Rules that still rest only on captured text are marked `source_in_supplied_corpus: false` (9 rules), and the app notes it on their source line. `pipeline/schedule.ts` then adds dated values (for example SF annual increases by period), each with its own verified quote, and `pipeline/complete-quotes.ts` extends any quote that stops mid-sentence to the end of that sentence, still as an exact slice of the source (5 rules).
6. **Jurisdiction (Module B: geocode, rooftop, zips).** Some NJ parcel rows list an out-of-state mailing ZIP; those are replaced for display with the ZIP of the geocoded match (27 rows). The Census batch geocoder is tried first. Failures get cleaned one-line retries (unit ranges, leading-zero ordinals, "AV"). Any match on a different house number is rejected. Points are then placed in Census incorporated places, so "Dorchester" resolves to Boston. 489 addresses got coordinates; 10 more got their legal city from an unambiguous postal neighborhood; 1 stays unresolved. A later rooftop pass (`rooftop.ts`) adds Google building points for the 3D camera only; it does not change legal jurisdiction or any rule result. `zips.ts` sets display ZIPs.
7. **Engine (deterministic, `src/lib/engine.ts`).** The pipeline, the UI and the submission all use the same engine. The rules, in order:
   - **Scope:** a rule is in scope when the address is in its state or legal city.
   - **Status:** `failed` rules are dropped and `pending` rules are reported as pending.
   - **Dates:** an effective date after the query date gives `not_yet_effective`.
   - **Coverage:** each coverage condition is tested against year built and unit count. Unit count comes from the record or from the assessor use code (for example "5 to 14 units" or NJ class 4C); a disagreement between the two becomes a range.
   - **Missing facts:** a missing or borderline fact gives `unknown`. Examples: a building in the same year as a certificate-of-occupancy cutoff, owner type, or a restricted program.
   - **Precedence:** a state rule that yields to stricter local law becomes `superseded` where the local rule applies.
   - **Conflicts:** `conflict_flag` marks only real rule-against-rule conflicts. Example: the NJ FAIR Act against the Jersey City and Hoboken bans.
8. **Change tracking (Module C).** `submit.ts` writes the three submission files last. T1–T5 re-run the engine at the test dates (`submission/changes.json`, with before/after results per address). `/new-law` and `pipeline/ingest.ts` take any new document through steps 2, 3 and 7. A fictional Cambridge ordinance we wrote to test this was read as "not yet effective, 2027-03-01" and flagged 48 of the 500 buildings.

## Accuracy

There is no public answer key. These figures come from an AI-assisted audit of 27 sample addresses: a separate Claude review pass checked the engine's results against the corpus text. The sample was 27 addresses covering all 9 cities and the edge cases: missing year or units, postal city different from legal city, cutoff-year buildings, new construction, and small buildings. It checked every address × rule decision.

| Round | Precision | Recall | Notes |
|---|---|---|---|
| 1 (first build) | 0.922 | 0.929 | 6 false positives, 15 wrong values, 4 misses |
| 2 | 0.983 | 0.983 | exemptions folded into coverage, restricted programs return unknown, notice ordinance added |
| 3 (final) | 1.000 | 1.000 | 281/281 decisions; owner-exemption caps, first effective dates, neighborhood fallback |

Fixes were made in the pipeline (prompt, schema or engine), not by hand-editing rules. **Caveat:** the same sample guided the fixes and the reviewer is a model. Round 2 (0.983) is therefore not held-out accuracy, round 3 is an optimistic upper bound, and neither is an official score. T1–T5 match `starter/dev/change_tests.json`.

## Responsible design

- **Sources:** every answer shows the citation, the verbatim quote, the source URL, the retrieval date, and the as-of date.
- **Status:** enacted, not yet effective, pending and failed law are kept separate. The struck MA ballot question is recorded as `failed`, and no rent cap is reported in Boston or Cambridge.
- **Unknowns:** `unknown` comes with the specific missing fact. Where two sources disagree, the panel shows it as "Sources disagree", kept separate from conflict flags.
- **Advice:** nothing suggests how to avoid a rule. A "Not legal advice" notice is on every page.
- **Server-side AI:** the AI runs only on the server. The ask bar is instructed to answer from the evaluated rules and cite rule IDs, but its wording can still be wrong; the rule list is the record.
- **Live research (beta):** results for cities outside the corpus are fetched separately at click time, shown in their own section, and are not part of the scored outputs in `submission/`.
- **Audit trail:** the audit trail is in `data/` (extractions, candidates, consolidation, audit).

## Limitations

- **Partial ordinance texts:** the full Hoboken (Chapter 155) and Newark (Title 19) ordinances on ecode360 could not be captured. Their rent-control rules come from official city regulations, rate sheets and FAQs instead, so provisions found only in the full ordinance may be missed. Most Hoboken and Newark sample buildings have no year built or unit count, so their rent-control results are mostly unknown.
- **Owner type:** owner names are deliberately excluded from the data, so owner-type rules stay `unknown` unless the building is too large for the owner exemption to reach.
- **Accuracy numbers:** precision and recall come from an AI-assisted audit of 27 sample addresses that also guided the fixes. They are not held-out accuracy and not an official score.
