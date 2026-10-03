# Accuracy audit: rules.json, lookups.json, changes.json

Independent check against corpus text, as of 2026-10-01. No code or data was changed.

## Headline numbers

I scored each address×rule decision. A decision counts as correct only when the rule and the `result` value both match. A wrong `result` counts against precision and recall.

| Scope | Correct | False positive | Wrong value | False negative | Precision | Recall |
|---|---|---|---|---|---|---|
| 27-address profile sample (one per profile, all 9 cities + edge cases) | 248 | 6 | 15 | 4 | **0.922** (248/269) | **0.929** (248/267) |
| All 500 (same corrections applied to every member of each profile) | 4743 | 80 | 276 | 52 | **0.930** | **0.935** |

Within each profile, every address got identical answers (checked by signature). The error count is driven by 7 systematic issues, listed below. No random noise showed up.

The following checked out against the corpus. Effective dates: FAIR Act 2027-07-01 (D069, "first day of the twelfth month" after 2026-07-20), NJ fee cap 2026-05-01 (D066), NJ Fair Chance 2022-01-01, Boston HSNA 2020-11-06 (D014), SD TPO 2023-06-24, Santa Ana 2021-11-19. Cutoffs: Santa Ana 1995-02-01, SF 1979-06-13 certificate of occupancy (CO), Berkeley June 1980 CO (D009), JC rent control `min_units` 5 ("All 1-4 Unit Properties are exempt", D036), NJ fee cap `min_units` 3 (D066 exempts one- and two-family dwellings), §1950.5 small-landlord cap 4. Boundary handling: the SF/LA year-of-cutoff unknowns, the AB 1482 15-year roll-off, San Ysidro, Dorchester and Roxbury. All 54 quoted_spans appear verbatim in their source doc. T1–T5 match `starter/dev/change_tests.json`: T1 = 250 CA, T2 = 50 JC + 40 Hoboken with no Newark, T3 = 140 NJ with 90 flagged, T4 = 110 MA, T5 = empty.

## Systematic issues, ranked by impact

1. **r-0041 (NJ 30-year new-construction exemption) is reported "applies" at all 140 NJ addresses.** It is an exemption from local rent control. It places no obligation on the landlord, and it cannot apply to pre-1996 buildings. 30 FP (JC + Newark built 1870–1930) and 106 wrong values (no year → should be `unknown`). Fix: stop emitting r-0041 as a lookup row. Fold it into r-0023 coverage instead: rent control is `unknown` when the year is missing or completion falls within 30 years of the query date. The engine also needs to support `built_after = asOf − 30y`.
2. **r-0025 (LA Just Cause Ordinance) has no age cutoff, so it "applies" to RSO buildings.** D040 says: "The JCO covers most residential properties … that are not regulated by the City's Rent Stabilization Ordinance". 47 FP (pre-1978) and 8 wrong values (built 1978 or year missing → `unknown`). Fix: add `coverage.built_after: "1978-10-01"` with `cutoff_basis: certificate_of_occupancy` (the inverse of r-0024/r-0027).
3. **The engine ignores `unverifiable_conditions` that restrict who is covered.** r-0050 (SF Fair Chance, "in affordable housing decisions", D078) and r-0011 (Boston DND policy, "Housing providers receiving DND funding and/or land, or … income restricted units", D010) both come out "applies" at every address. They should be `unknown`: 80 + 60 wrong values. Fix: add a coverage flag such as `restricted_population: true` and have `evaluateOne` return `unknown`. Conduct-triggered conditions (algorithmic bans, relocation on eviction) should stay "applies".
4. **Missing law: Cambridge Tenants Rights and Resources Notification Ordinance, ch. 8.71 (D031).** This is the Cambridge equivalent of Boston HSNA r-0008, and it covers all 50 Cambridge addresses (50 FN). See the quote below. Add it as `just_cause_eviction`, city level, with no coverage limits.
5. **r-0023 (Jersey City rent control) is reported "applies" when the year is missing.** That covers 22 JC addresses. The rent control is "applies" only because use code 4C is read as 5+ units, but N.J.S.A. 2A:42-84.5 exempts buildings for 30 years after completion. Without a year, the answer is `unknown` (22 wrong values). Fix #1 resolves this.
6. **A0009 was geocoded to the wrong city.** The input is "322-322.5 Western Ave, Cambridge" (Cambridge use code 111, 6 units). It was matched by a `census-clean` fallback to "5 WESTERN AVE … 02163", a different house number in Allston, which made `legal_city` Boston. Result: 3 FP (r-0008, r-0011, r-0012) and 2 FN (r-0020, ch. 8.71). Fix in `pipeline/geocode.ts`: reject fallback matches whose house number or ZIP differs from the input. Then use postal_city when it is itself a covered city, or leave `legal_city` null (which gives `unknown` scope).
7. **A0227 has conflicting unit counts.** The record says `units=2`, but `use_description` "13B-93U-2C-G" means 93 units. `unitRange` trusts the record, so r-0038 (NJ $50 fee cap, ≥3 units) is dropped (1 FN). Fix: when the record and the description disagree, return `{min: null, max: null}`, which gives `unknown`.
8. **Conflict flags are noisy.** 335 of 500 addresses carry a flag, because r-0015/r-0016 list every CA local ordinance in `conflicts_with`. Superseding settles the state-versus-local question, so these are not open conflicts. A grader looking for the T3 flags (JC/Hoboken versus FAIR) will see them buried. Fix: limit `conflicts_with` to r-0037↔r-0021/r-0022 and r-0041↔r-0023. Also set `conflict_flag: true` on r-0001: README §9 lists the Berkeley date dispute, and the rule's own `conflict_note` describes it.

## rules.json record-level findings (no lookup impact unless noted)

- **r-0045 San Diego algorithmic ban**: the source is D076, a staff report and draft with blank adoption and passage lines. The in-force status and the "2025-06" date come only from D002 (Morgan Lewis: "San Diego Mun. Code §§ 98.1101 98.1104 (effective June 2025)"). Cite D002 for status and date, or lower `confidence`.
- **r-0018 CRC criminal-history regs**: the effective date 2020-01-01 is not in D016. The 2020 date in D015 is for SB 329 source-of-income ("as of Jan. 1, 2020, state law prohibits landlords from refusing to participate"), so that date belongs on **r-0017**, which has no `effective_date`.
- **r-0049 SF rent control**: the cutoff comes from D079 ("first obtained a Certificate of Occupancy after June 13, 1979"), but `source_doc_id`/`quoted_span` point to D080, which does not state the cutoff. Add D079 as the coverage citation.
- **r-0024/r-0027/r-0028**: `cutoff_basis` should be `certificate_of_occupancy` per README §4.1. Results don't change, because the engine already treats 1978 as unknown, but the explanation text says "construction".
- **Weak quoted_spans** that don't support the requirement: r-0024 ("Legal Reasons for Eviction Tenant is at-fault Failure to pay rent"), r-0028 ("Interest Payments on Security Deposits"), r-0027 (cut off mid-sentence at "(click here to"), r-0041 (sentence fragment), r-0011 ("a) Arrests that did not result in conviction.").
- **r-0027 key_value is stale**: "3% for 7/1/2025–6/30/2026" expired before the query date. The note admits this. Show "rate for 2026-27 not in corpus" instead of a figure that is no longer in force.
- **r-0013**: the citation omits SB 763, which T1 names and D028 describes ("Assembly Bill 325 (AB 325) and Senate Bill 763"). Add it to the citation; don't create a second rule.
- **Duplicates**: none harmful. r-0009/r-0010 split one failed bill by category, and r-0031/r-0036 split §15B. Both are fine.

## Corpus laws missing from rules.json

| doc_id | Law | Exact quote | Severity |
|---|---|---|---|
| D031 | Cambridge Tenants Rights and Resources Notification Ordinance, CMC ch. 8.71 | "The Ordinance requires owners, landlords, and management companies to provide you with information at the start of your lease or tenancy as well as when your tenancy is being terminated." Penalty: "You may be fined $300 for each day's violation." | High (50 addresses) |
| D051 | M.G.L. c. 186 § 12, notice to quit for tenancy at will | (statute text, §12; r-0033 bundles §§ 11, 18, 31 but not 12) | Low; fold into r-0033's citation |
| D048 | M.G.L. c. 40P § 4, ban on local rent control | "No city or town may enact, maintain or enforce rent control of any kind" | Already in `no_rule_findings.json`; OK as a negative finding for T5 |

Not counted as misses: Hoboken and Newark rent control, and the San Diego source-of-income ordinance. Their sources (D032–34, D070–72, D075) are link-only, or the captured page has no ordinance text, so there is nothing to extract. D030 (Cambridge) is a council policy order to draft options, not a bill, so it correctly produces no rule. D039 (LA) is a 2024 study motion, correctly recorded as a gap.

## How I judged edge cases

- Event-conditioned rules (algorithmic bans, relocation, HSNA, RPO) are "applies".
- A state rule is accepted as `unknown` rather than `superseded` when its own coverage is unknown, for example r-0015 in Berkeley or SF where the year is missing.
- `unknown` is accepted for owner-type rules where the unit count is missing (Boston A/125, A/120).

Under the README's 2× cost for misses, issue 4 (FN) weighs most per address, and issue 1 is the largest by volume.

---

## Round 2 (re-audit after pipeline fixes; 56 rules, ids renumbered)

Same 27-address sample. I re-derived the expected results against the new rule ids. Old Berkeley Ellis relocation (old r-0004) is now merged into r-0003, so I don't count it as a miss.

| Scope | Correct | False positive | Wrong value | False negative | Precision | Recall |
|---|---|---|---|---|---|---|
| 27-address sample | 284 | 0 | 5 | 0 | **0.983** (284/289) | **0.983** (284/289) |
| All 500 (profile-extrapolated) | 5352 | 0 | 126 | 3 | **0.977** | **0.976** |

Round 1 was 0.922 / 0.929 on the sample. The cost-weighted error, with misses counted at 2x, dropped from 4+21 to 0+5. T1–T5 still match `change_tests.json`. Conflict flags now sit only on the 90 Jersey City and Hoboken addresses. All 56 quoted_spans are verbatim.

### Status of the 8 Round 1 issues

| # | Issue | Status |
|---|---|---|
| 1 | NJ 30-year exemption reported as a rule | **Resolved.** Folded into r-0024 `age_years_exempt: 30`. |
| 2 | LA JCO reported on RSO buildings | **Partial.** `built_after: 1978-10-01` was added, but see R2-2 below. |
| 3 | Rules for a restricted population reported as "applies" | **Resolved.** r-0010 and r-0052 are `unknown`; the new r-0015 (HCA) is `unknown`. |
| 4 | Cambridge ch. 8.71 missing | **Resolved.** r-0020 covers 50 addresses. |
| 5 | JC rent control with no year | **Resolved.** r-0024 is `unknown`. |
| 6 | A0009 geocoded to Boston | **Resolved.** Now Cambridge, but see the geocode regression R2-3. |
| 7 | A0227 conflicting unit counts | **Resolved.** The unit range gives `unknown` for r-0039. |
| 8 | Conflict-flag noise; r-0001 flag | **Mostly resolved.** 335 → 90 flagged addresses. r-0001 `conflict_flag` is still false despite the README §9 date dispute. |

### Remaining issues, ranked

1. **Regression: Berkeley r-0003 (just cause) and r-0006 (deposit interest) are `unknown` at all 40 addresses (80 wrong values).** Both now have `owner_type_dependent: true` with `owner_exemption_max_units: null`, so `ownerCheck` can never pass. The exemptions in D009 are owner-occupied duplex, shared kitchen or bath, and ADU pairs: "“Golden Duplex”: duplex that was owner-occupied on December 31, 1979". None of these can reach a 5+ unit building. Fix: set `owner_exemption_max_units: 2` on both. Also make the consolidator reject `owner_type_dependent: true` with a null cap, or have the engine warn on it.
2. **Regression: LA JCO r-0026 is `unknown` at the 25 post-1978 addresses.** It has the same null-cap problem. This also pushes CA just cause r-0014 to `unknown` at 21 addresses where it should be `superseded`, for 46 wrong values in total. The owner exception is the owner's-roommate case, which old r-0025 capped at 1. Fix: set `owner_exemption_max_units: 1`.
3. **Geocode regression: A0242 (Hyde Park) and A0344 (Jersey City) now have `legal_city: null`.** For A0344, postal equals the city, so the result degrades to `unknown` and is acceptable. For A0242, the postal city "Hyde Park" matches no rule jurisdiction, so it loses Boston r-0008, r-0010 and r-0011 (3 misses). Fix: when the geocoder returns no match, fall back to a postal-city alias table: the Boston neighborhoods Hyde Park, Dorchester, Roxbury, Allston, Brighton, Mattapan, Jamaica Plain, East and South Boston map to Boston; San Ysidro maps to San Diego. Also find out why A0344 lost the match it had in Round 1.
4. **r-0014 (CA §1946.2) `effective_date` is 2024-04-01**, the operative date of the amended text. The Tenant Protection Act's just-cause rule has been in force since 2020-01-01, which is r-0016's date for the companion section. Any as-of query between 2020 and March 2024 would wrongly return `not_yet_effective`. Fix: set `effective_date: 2020-01-01` and keep the amendment dates in `conflict_note`.
5. **Leftover source problems (no lookup impact):**
   - r-0018's 2020-01-01 date still comes from D015's SB 329 sentence, which is about source of income, not criminal-history regulations. Cite it as unverified or drop it.
   - r-0051's cutoff comes from D079, but the rule cites D083.
   - r-0001 `conflict_flag` should be true.
   - These quoted_spans are still headings that don't support their rules: r-0025 ("Legal Reasons for Eviction"), r-0028 ("Interest Payments on Security Deposits"), r-0027.
   - r-0036 now has `owner_exemption_max_units: 3`. §4(6) exempts an owner-occupied two-family dwelling, so 2 is right unless the §4(7) three-unit elderly exemption is what's intended. Results are unchanged because no MA address is known to have ≤3 units.

Fixing 1 and 2 should lift both precision and recall above 0.99 on all 500 addresses.
