# Groundtruth: remaining work

Updated October 3, 2026 after rules, code, and live-demo review. Solo RealPage entry. Target submission: **October 4, 4:30 AM Pacific**. Hard deadline: **6:00 AM Pacific**. Both HackOS and Google Form required.

## Goal and score boundary

Build an address-level housing-law tool with automated extraction, accurate coverage, substantive citations, and dated changes. Modules A/B/C exist and published T1–T5 behavior matches. This does not establish complete legal accuracy or guarantee a high score.

General rubric: technical depth 33%, communication 33%, innovation/creativity 33%. Correctness supports technical depth; clear evidence and a focused demo support communication. No official scorer or answer key is available. Use v5 and organizer clarifications: no hour-16 surprise law or score.py requirement.

## Verified baseline

- [x] All 54 supplied texts plus 16 captured sources processed: 200 candidates, 55 consolidated rules.
- [x] Exactly all 500 sample IDs included; custom required-field/type/enum/pattern checks passed for 55 records.
- [x] Default output agrees with shared engine; published T1 250, T2 90, T3 140 with 90 conflicts, T4 110, T5 zero match.
- [x] Typecheck/build pass; lint has zero errors and two warnings.
- [x] Hosted LA lookup, 3D view, source expansion, date transition, and Q&A worked.
- [x] Hosted fictional Cambridge ingestion: one rule, one matched quote, 48 affected buildings.
- [x] Public repo/live demo exist. Demo video 58.47 s; technical video 55.60 s. Full videos still need end-to-end review.

## P0: complete submission

- [ ] Make team introduction video, at most 60 seconds: who Tarun is, what he built, and why. Visible form does not explicitly require an on-camera recording.
- [ ] Supply team photo. Confirm both submissions identify the same participant and project.
- [ ] Watch three final videos end to end: narration, captions, readable evidence, accurate limitations, duration, audio. Label accelerated waits.
- [ ] Upload photo and three videos to HackOS; verify playback and saved draft. Last inspected: draft, 0/3 videos, no photo.
- [ ] Complete Google Form: solo identity, challenge 2, repo, hosted demo, videos, picture. Last inspected: incomplete draft. No resubmissions.
- [ ] Review MIT terms and add standard MIT LICENSE if that matches intended licensing; README says MIT but no LICENSE file exists.
- [ ] Complete both final submissions before 6:00 AM; verify confirmation on each. Do not rely on 15-minute grace.

## P1: accuracy and evidence

- [x] **Version dated values and amendments.** Done (cff6ab4, 447b9d4): `pipeline/schedule.ts` adds verified `value_schedule`; RuleRow and `/api/ask` use `valueAt`. SF r-0054 shows 1.4% on 2025-12-31, 1.6% from 2026-03-01, "not stated" after 2027-02-28. LA RSO allowable increase has no supplied 2026-27 figure, so it shows "not stated" for 2026-10-01 while `key_value` keeps the 2025-26 3%.
- [x] **Replace heading-only evidence.** Done (416dbee): `isSubstantiveQuote` in extraction, consolidation fallback, prefer-supplied. LA just cause now quotes "No-fault evictions require the payment of relocation assistance."; LA deposit interest cites the captured D044 ordinance text (marked captured-only). Only remaining short quotes are the two MA bill titles (allowed for pending bills).
- [x] **Address incomplete Hoboken/Newark coverage.** Partly: ecode360 terms unreadable (403), so no ecode360 fetch. Captured official Hoboken Ch. 155 regulations + CPI cap sheet (D032, D033) and the Newark Rent Control FAQ (D070). New rules: Hoboken rent leveling (5% cap), Newark CPI-U cap, Newark anti-reprisal. Full ordinance text still missing; `src/lib/coverage-gaps.ts` warns when a known local law is absent.
- [ ] **Keep citation eligibility honest.** Four captured-only rules: r-0022, r-0023, r-0036, r-0053; 90 lookup entries depend on Hoboken/Jersey City citations. Research capture allowed, citation credit excluded unless organizers officially map text into distributed corpus. Do not hide useful rules or relabel evidence as supplied.
- [x] **Handle all unresolved applicability conditions.** Done: structured `coverage.depends_on_unknown_fact` (extraction + consolidation) gates to unknown in the engine; live-research rules with any `unverifiable_conditions` evaluate to unknown.
- [x] **Reject invalid Q&A citations.** Done (1fd64a4): `src/lib/ask-validate.ts`, one corrective retry, then insufficient-record answer. Offline test: `npx tsx scripts/test-ask-validate.ts`.
- [ ] **Add independent checks capable of finding errors.** Small held-out set: missing facts, CO cutoff years, temporal rate changes, NJ boundaries/preemption, failed MA measures. Keep it out of extraction/consolidation prompts. Report method, size, and remaining failures; sample performance is not official score.
- [x] **Validate regenerated outputs.** 59 rules, schema checks pass, 59/59 rule quotes + 32/32 schedule quotes verbatim, 206/206 candidate quotes verified, 500/500 lookup IDs, T1 250, T2 90/90, T3 140/90, T4 110, T5 0.

## P1: copy cleanup

Each line should help someone find an address, understand a rule, inspect evidence, or take a clear next step. Use normal English in app text. Preserve legal meaning and exact quotations. Keep required notices, dates, missing facts, and coverage gaps; remove repetition and misplaced technical detail.

- [ ] Audit landing, answer panel, new-law, research, changes, Method, README, pitch, captions together. No universal-coverage or accuracy guarantees.
- [ ] Landing: one benefit line, e.g. “Find the housing rules for an address.” Put CA/NJ/MA scope nearby. Remove “any date” until dated provisions work.
- [ ] RuleRow: default “Source note”; “Conflicting sources” only for actual disagreements. Classify notes structurally. Short conflict text: “May conflict with [law]. Review both sources.” Keep beside affected rule.
- [ ] Source labels: “Additional source” for captured text; explain retrieval/eligibility in expanded source details and Method. No hackathon jargon dominating renter answer.
- [ ] Live research: “Find local laws” + Beta badge; “Additional web results” heading. Say quotes matched, not rules legally verified. Show actual retrieval time for cached results, not “just now.” Keep exclusion from main totals and unreviewed warning once per section.
- [ ] Remove repeated counsel badges/checkmarks and uncalibrated confidence percentages; keep warnings for unofficial sources where relevant. One compact section notice: “Not legal advice. These results have not been reviewed. Check the source for current law.”
- [ ] CoverageNote: “Local laws for [city] are not included. Showing statewide rules.” Keep missing local coverage prominent. Put Census/Google diagnostics behind “Address match details”; keep uncertain building match visible.
- [ ] New-law: replace timer-based useFakeProgress with actual server stages or one honest “Reading document…” state. Current timers mark work done without confirmation.
- [ ] Put model names, Zod, pipeline/count details on Method and technical walkthrough. Keep text-to-AI disclosure beside ingestion action; do not promise provider retention behavior the app cannot verify.
- [ ] Changes: say “law or proposal,” not five actual law changes. Move T1–T5 to secondary “Challenge checks” labels; remove internal rule IDs and “expected answer for this test” from main product text. Date range labels: “From [date] to [date].” Empty state: “No recorded status changes during this period.”
- [ ] Method: “public law and related sources,” not all official documents. Distinguish 87 manifest entries, 54 supplied texts, 16 captured texts, 70 processed texts, 10 law-scope cities, 9 sample cities. Acknowledge separately fetched beta results.
- [ ] Accuracy: “AI-assisted audit of 27 addresses.” Same sample guided fixes; 0.983 is not held-out/general accuracy. Remove unqualified “independent audit,” “never a guess,” and “only from cited rules” guarantees until enforcement matches.

## P2: reproducibility and demo reliability

- [ ] README: 55 rules, not 56; correct entirely-supplied-corpus claim.
- [ ] Document actual order: permitted capture if needed → extract → consolidate → prefer-supplied → geocode → rooftop → zips → submit. Distinguish camera-only enrichment from legal jurisdiction work. README omits citation preference pass.
- [ ] Shared atomic limits and daily spend/concurrency budget for paid endpoints; current limits reset per instance. Restrict costly beta actions if necessary to preserve core demo.
- [ ] Resolve two unused-variable lint warnings. Re-run proportionate checks after changes; recheck public deployment and recorded-demo consistency.

## Optional additions: choose one after P0/P1

Recommended: evidence-first polish. Improve an existing proof/comparison view. Broad new features cost time before known gaps are closed.

1. **Compact validation section on Method (recommended).** Actual validation outputs: check-set size, T1–T5, citation eligibility, known gaps, generated timestamp. No invented scores/confidence. Makes technical evidence visible without another large workflow.
2. **Two-date comparison in existing changes view.** Compare exact requirement/rate changes and supporting text, not only status. Depends on temporal fix. Strong demo: “What changed for this building?”
3. **Shareable evidence summary.** Print/save-PDF from current answer: address/date, facts, applicable/unknown rules, quotes, retrieval dates, missing coverage. No new legal prose or compliance certificate.

Defer Spanish, more jurisdictions, voice agents, extra cinematic effects, broad dashboards. Spanish is an official stretch goal, but core correctness and reviewed legal/status wording come first.

## Final demo story

One address → relevant rule → substantive source → explain an unknown → meaningful date change → automated new-document extraction. State coverage/validation limits briefly. Show working output rather than promising a score.
