# Groundtruth: method note

**Question answered:** for each sample address, which rental housing rules apply on the query date, and how do the supplied change cases affect the answer? Every answer is tied to verbatim source text and a retrieval date. Not legal advice.

## Pipeline

1. **Corpus.** We used the 54 supplied text documents. We also fetched 16 of the 33 link-only sources one page at a time with recorded retrieval dates: law-firm, news and legislature pages, including the WBUR report on the struck Massachusetts ballot question and the Hoboken and Jersey City ban coverage. The RealPage organizer confirmed in the event Discord that capturing link-only pages is allowed. Publisher sites that refused automated access (ecode360, Justia, American Legal) were not captured, and we did not bulk-scrape anything.
2. **Extraction (Module A, automated).** Claude Opus 5.5 reads each document whole (no chunking) with a fixed prompt and returns structured output that is validated against a Zod schema. That schema is the challenge's rule schema plus a machine-checkable coverage block: unit limits, built-before and built-after cutoffs, whether the cutoff is a construction or certificate-of-occupancy date, rolling new-construction exemptions, owner-type dependence with the largest building the owner exemption can reach, and rules limited to specific programs. 70 documents produced 200 candidate rules.
3. **Quote verification.** Each `quoted_span` must appear in its source document. Whitespace and quote style are normalized for the search, and the exact original text is stored. 200 of 200 candidate quotes matched verbatim. A rule whose quote can't be found is never used.
4. **Consolidation.** A second Claude pass sees all candidates. It merges the same law cited by several documents, keeping the most official verified source. It folds exemptions and procedural sub-rules into their headline rule, and sets effective dates, statuses (`in_force`, `not_yet_effective`, `pending`, `failed`), state-yields-to-local precedence, and genuine preemption conflicts. The result is **55 rules**. Each one traces back to the candidates and documents it came from (`data/consolidation.json`).
5. **Jurisdiction (Module B).** The Census batch geocoder is tried first. Failures get cleaned one-line retries (unit ranges, leading-zero ordinals, "AV"). Any match on a different house number is rejected. Points are then placed in Census incorporated places, so "Dorchester" resolves to Boston. 489 addresses got coordinates; 10 more got their legal city from an unambiguous postal neighborhood; 1 stays unresolved.
6. **Engine (deterministic, `src/lib/engine.ts`).** The pipeline, the UI and the submission all use the same engine. The rules, in order:
   - **Scope:** a rule is in scope when the address is in its state or legal city.
   - **Status:** `failed` rules are dropped and `pending` rules are reported as pending.
   - **Dates:** an effective date after the query date gives `not_yet_effective`.
   - **Coverage:** each coverage condition is tested against year built and unit count. Unit count comes from the record or from the assessor use code (for example "5 to 14 units" or NJ class 4C); a disagreement between the two becomes a range.
   - **Missing facts:** a missing or borderline fact gives `unknown`. Examples: a building in the same year as a certificate-of-occupancy cutoff, owner type, or a restricted program.
   - **Precedence:** a state rule that yields to stricter local law becomes `superseded` where the local rule applies.
   - **Conflicts:** `conflict_flag` marks only real rule-against-rule conflicts. Example: the NJ FAIR Act against the Jersey City and Hoboken bans.
7. **Change tracking (Module C).** T1–T5 re-run the engine at the test dates (`submission/changes.json`, with before/after results per address). `/new-law` and `pipeline/ingest.ts` take any new document through steps 2, 3 and 6. A fictional Cambridge ordinance we wrote to test this was read as "not yet effective, 2027-03-01" and flagged 48 of the 500 buildings.

## Accuracy

There is no public answer key, so a separate Claude review pass audited a stratified sample by hand against the corpus text. That sample was 27 addresses covering all 9 cities and the edge cases: missing year or units, postal city different from legal city, cutoff-year buildings, new construction, and small buildings. It checked every address × rule decision.

| Round | Precision | Recall | Notes |
|---|---|---|---|
| 1 (first build) | 0.922 | 0.929 | 6 false positives, 15 wrong values, 4 misses |
| 2 | 0.983 | 0.983 | exemptions folded into coverage, restricted programs return unknown, notice ordinance added |
| 3 (final) | 1.000 | 1.000 | 281/281 decisions; owner-exemption caps, first effective dates, neighborhood fallback |

Every fix was made in the pipeline (prompt, schema or engine), never by hand-editing a rule. **Caveat:** fixes were guided by this same sample and the reviewer is a model, so round 3 is an optimistic upper bound. Round 2 is the more honest estimate of performance on unseen buildings. T1–T5 match `starter/dev/change_tests.json`.

## Responsible design

- **Sources:** every answer shows the citation, the verbatim quote, the source URL, the retrieval date, and the as-of date.
- **Status:** enacted, not yet effective, pending and failed law are kept separate. The struck MA ballot question is recorded as `failed`, and no rent cap is reported in Boston or Cambridge.
- **Unknowns:** `unknown` comes with the specific missing fact. Where two sources disagree, the panel shows it as "Sources disagree", kept separate from conflict flags.
- **Advice:** nothing suggests how to avoid a rule. A "Not legal advice" notice is on every page.
- **Server-side AI:** the AI runs only on the server. The ask bar answers only from the evaluated rules and cites rule IDs.
- **Audit trail:** the audit trail is in `data/` (extractions, candidates, consolidation, audit).

## Limitations

- **Missing ordinance texts:** Hoboken and Newark ordinances on ecode360 could not be captured, so Newark has no city-level rules and Hoboken has only its algorithmic ban, which comes from secondary sources at lower confidence. Missing local rent-control rules there are known false negatives.
- **Owner type:** owner names are deliberately excluded from the data, so owner-type rules stay `unknown` unless the building is too large for the owner exemption to reach.
- **Accuracy numbers:** precision and recall are measured by an AI-assisted audit on a sample, not against the official answer key.
