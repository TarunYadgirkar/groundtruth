<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ongoing

Updated: 2026-10-04T06:40Z (Oct 3, 11:40 PM PT) by claude session

Context: Hack-Nation 7 (Oct 3–4, 2026), RealPage "Rental Housing Law Navigator" challenge, solo (Tarun Yadgirkar), team "Groundtruth". **Hard deadline Sun Oct 4, 6:00 AM PT**, and BOTH HackOS and the Google Form must be submitted (no resubmissions on the form). Live: https://groundtruth-rho.vercel.app · Repo: https://github.com/TarunYadgirkar/groundtruth. Rules and logistics notes are in `../README.md` and `../EVENT-CONTEXT.md` (outside the repo). The v5 participant guide in `starter/README.md` is authoritative: no score.py, no dev answer key, no hour-16 ordinance. `starter/` is byte-identical to the organizer's Discord zip `MIT-hackathon-PARTICIPANT-PACK-CLEAN-NO-HOUR16.zip` (checked with diff). The organizer (Discord, 3:20 PM) said captured link-only texts do not count toward the citation metric.

Done:
- Data pipeline (`pipeline/`), fully automated: `extract.ts` (Claude Opus 5.5 structured outputs per doc; 70 docs = 54 supplied + 16 captured link-only via `capture.ts`, as the organizer allowed in Discord) → `consolidate.ts` (verbatim quote check 200/200, merge to 55 rules, precedence and conflicts) → `geocode.ts` (Census batch, then cleaned retries, then house-number check, then postal-neighborhood fallback; 499/500 legal city) → `rooftop.ts` (Google rooftop points for the camera) → `zips.ts` → `submit.ts` (writes `submission/rules.json`, `lookups.json`, `changes.json`). T1–T5 match `starter/dev/change_tests.json`.
- Deterministic engine `src/lib/engine.ts`, shared by the pipeline, UI and submission: coverage, unit ranges from use codes, CO cutoffs, owner-exemption caps, RESTRICTED programs, superseded, conflicts, structured `checks` rows.
- Accuracy: an AI-assisted audit in `data/audit.md` scored precision/recall 0.922 / 0.929 → 0.983 / 0.983 → 1.000 (round 3 is on the same sample that guided the fixes, so it is optimistic; quote round 2).
- Web app: landing → cinematic Google 3D descent (pre-load, ground height, street-facing; Skip/Esc; 3.6 s hop for repeat lookups) → answer panel (why table, sources-disagree, conflict flags) → time slider and "What changed" → ask bar (`/api/ask`, Claude, grounded and cited). Pages: `/changes` (T1–T5), `/new-law` (`/api/ingest`: paste an ordinance → extract → verify → affected buildings; the fictional Cambridge sample gives 48/500), `/method`. Typed addresses: `/api/place` (Census legal city), `/api/normalize` (Claude cleanup), building-facts form. QA pass (15 fixes), all 500 addresses verified (`scripts/verify-addresses.mjs` → `data/address-verification.json`).
- Docs: `README.md`, `METHOD.md`, `assets/generated/Groundtruth_OnePager.pdf`, `assets/generated/summary.txt` (300-word pitch).
- Videos (`assets/generated/videos/`): `demo-vo.mp4` (58.5 s) and `tech-vo.mp4` (55.6 s), narrated with ElevenLabs "George" via `pipeline/voiceover.ts`. Captions are burned in, and waits shown sped up are labelled. Silent versions are `demo.mp4` and `tech.mp4`. Recording scripts were in the session scratchpad (not in the repo).
- Deploy: Vercel project `groundtruth` (team taruns-projects-248def65), env vars `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (all environments) and `ANTHROPIC_API_KEY` (production). The Maps key (GCP project "My Maps Project", free trial) is restricted by referrer to localhost:3000, localhost:3100 and groundtruth-rho.vercel.app.
- HackOS: solo team "Groundtruth" created; draft saved with name, challenge 02 RealPage, GitHub and live URL. Not submitted.
- Citations (98a6fcf): `pipeline/prefer-supplied.ts` runs after consolidate. It switches rules citing captured pages to a verified supplied-corpus quote when one exists (2 switched: LA deposit interest → D041, San Diego ban → D076) and marks the rest `source_in_supplied_corpus: false` (r-0022 Hoboken, r-0023 Jersey City, r-0036 MA IP 25-21, r-0053 Santa Ana). T1–T5 output unchanged. Pipeline order: extract → consolidate → prefer-supplied → geocode → rooftop → zips → submit.
- Live research (beta, 22b8780..c398a1f): `/api/research` (Claude web search + fetch, quotes verified against the fetched page text, per-city cache) and the "Research <city> law live" button for non-covered CA/NJ/MA cities and out-of-state addresses. Separate amber section, never in totals or `submission/`. Link-only sources now carry a note on their source line. Uses `web_search_20250305`/`web_fetch_20250910` (the `_20260209` versions took 73–146 s; `RESEARCH_TOOLS=dynamic` switches). Tested: Oakland 8–9 rules in ~70 s, Somerville 2, Trenton 2, Austin TX 4; bad input 400, rate limit 429. Limits: results vary run to run, rate limit and cache are per Vercel instance, municode pages fetch blank. Test script: `node scripts/test-research.mjs <base> "<address>" <shot.png>`.

- Correctness pass (Oct 3, 11:40 PM PT, 1fd64a4..447b9d4): Hoboken/Newark official sources captured (D032, D033 Hoboken Ch. 155 regs + CPI cap sheet; D070 Newark Rent Control FAQ; ecode360 terms returned 403 so it was not fetched); substantive-quote check (`isSubstantiveQuote`/`quoteSupportsRule`) in extraction, consolidation and prefer-supplied; `pipeline/schedule.ts` adds verified `value_schedule` (10 rules), picked by `valueAt` in RuleRow and `/api/ask`; `coverage.depends_on_unknown_fact` gate in the engine; live-research rules with unverifiable conditions are unknown; Q&A rejects unknown citations (retry once, then insufficient-record); `src/lib/coverage-gaps.ts` notice. Rules 55 → 59. T1–T5 unchanged. Pipeline order now: extract → consolidate → prefer-supplied → schedule → (geocode → rooftop → zips, done) → submit.

In flight:
- none

Blocked:
- Team intro video (≤60 s, MP4/MOV, Tarun on camera) and team photo: needed for both HackOS and the Google Form. Only Tarun can make these.

Next:
0. Follow `PLAN.md` for the updated remaining-work checklist. October 3 review found unresolved temporal-value errors, heading-only citations, incomplete Hoboken/Newark local coverage, conditional beta rules marked applies, and Q&A citation validation that fails open. Published T1–T5 match, but this is not complete legal accuracy or an official score. Correctness and copy cleanup precede optional additions.
1. Get the team intro video and photo from Tarun (put them in `assets/generated/`).
2. HackOS (app.hack-nation.ai → Team & Submission): upload the team photo, team intro, product demo = `demo-vo.mp4`, technical walkthrough = `tech-vo.mp4`, then Save draft. Show Tarun before clicking Submit project.
3. Google Form (forms.gle/VS65tsovASMuBwEn9): Solo; team name N/A; email tyadgirkar@gmail.com; name; affiliation (draft said Berkeley); challenge "2. RealPage"; upload the 3 videos; GitHub URL; live demo URL; team picture; T&C. Show Tarun the filled form before Submit (no resubmissions).
4. Complete the P1 accuracy, evidence, and copy tasks in `PLAN.md` before optional additions. Missing Newark/Hoboken coverage is a correctness gap, not optional polish. Qualify audit figures as AI-assisted sample results. Shared API budgets and reproducible rebuild steps are tracked under P2.
5. Local dev: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key> npx next dev -p 3000`. The `.env.local` copy of the Maps key was mistyped earlier; the console key ends `…3y8`, and process env overrides the file. Keys live in `.env.local` (Anthropic, ElevenLabs); never commit them. The pipeline's server-side Google geocoding (`geocode.ts`/`rooftop.ts`) needs an unrestricted key and is already done.
