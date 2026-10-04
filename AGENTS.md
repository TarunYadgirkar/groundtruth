<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ongoing

Updated: 2026-10-04T00:20Z (Oct 3, 5:20 PM PT) by claude session

Context: Hack-Nation 7 (Oct 3–4, 2026), RealPage "Rental Housing Law Navigator" challenge, solo (Tarun Yadgirkar), team "Groundtruth". **Hard deadline Sun Oct 4, 6:00 AM PT**, and BOTH HackOS and the Google Form must be submitted (no resubmissions on the form). Live: https://groundtruth-rho.vercel.app · Repo: https://github.com/TarunYadgirkar/groundtruth. Rules and logistics notes are in `../README.md` and `../EVENT-CONTEXT.md` (outside the repo). The v5 participant guide in `starter/README.md` is authoritative: no score.py, no dev answer key, no hour-16 ordinance.

Done:
- Data pipeline (`pipeline/`), fully automated: `extract.ts` (Claude Opus 5.5 structured outputs per doc; 70 docs = 54 supplied + 16 captured link-only via `capture.ts`, as the organizer allowed in Discord) → `consolidate.ts` (verbatim quote check 200/200, merge to 55 rules, precedence and conflicts) → `geocode.ts` (Census batch, then cleaned retries, then house-number check, then postal-neighborhood fallback; 499/500 legal city) → `rooftop.ts` (Google rooftop points for the camera) → `zips.ts` → `submit.ts` (writes `submission/rules.json`, `lookups.json`, `changes.json`). T1–T5 match `starter/dev/change_tests.json`.
- Deterministic engine `src/lib/engine.ts`, shared by the pipeline, UI and submission: coverage, unit ranges from use codes, CO cutoffs, owner-exemption caps, RESTRICTED programs, superseded, conflicts, structured `checks` rows.
- Accuracy: an AI-assisted audit in `data/audit.md` scored precision/recall 0.922 / 0.929 → 0.983 / 0.983 → 1.000 (round 3 is on the same sample that guided the fixes, so it is optimistic; quote round 2).
- Web app: landing → cinematic Google 3D descent (pre-load, ground height, street-facing; Skip/Esc; 3.6 s hop for repeat lookups) → answer panel (why table, sources-disagree, conflict flags) → time slider and "What changed" → ask bar (`/api/ask`, Claude, grounded and cited). Pages: `/changes` (T1–T5), `/new-law` (`/api/ingest`: paste an ordinance → extract → verify → affected buildings; the fictional Cambridge sample gives 48/500), `/method`. Typed addresses: `/api/place` (Census legal city), `/api/normalize` (Claude cleanup), building-facts form. QA pass (15 fixes), all 500 addresses verified (`scripts/verify-addresses.mjs` → `data/address-verification.json`).
- Docs: `README.md`, `METHOD.md`, `assets/generated/Groundtruth_OnePager.pdf`, `assets/generated/summary.txt` (300-word pitch).
- Videos (`assets/generated/videos/`): `demo-vo.mp4` (58.5 s) and `tech-vo.mp4` (55.6 s), narrated with ElevenLabs "George" via `pipeline/voiceover.ts`. Captions are burned in, and waits shown sped up are labelled. Silent versions are `demo.mp4` and `tech.mp4`. Recording scripts were in the session scratchpad (not in the repo).
- Deploy: Vercel project `groundtruth` (team taruns-projects-248def65), env vars `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (all environments) and `ANTHROPIC_API_KEY` (production). The Maps key (GCP project "My Maps Project", free trial) is restricted by referrer to localhost:3000, localhost:3100 and groundtruth-rho.vercel.app.
- HackOS: solo team "Groundtruth" created; draft saved with name, challenge 02 RealPage, GitHub and live URL. Not submitted.
- Live research (beta): `/api/research` (Claude web search + fetch, quotes verified against the fetched page text, per-city cache) and the "Research <city> law live" button for non-covered CA/NJ/MA cities and out-of-state addresses. Separate amber section, never in totals or `submission/`. Link-only sources now carry a note on their source line.

In flight:
- none

Blocked:
- Team intro video (≤60 s, MP4/MOV, Tarun on camera) and team photo: needed for both HackOS and the Google Form. Only Tarun can make these.

Next:
1. Get the team intro video and photo from Tarun (put them in `assets/generated/`).
2. HackOS (app.hack-nation.ai → Team & Submission): upload the team photo, team intro, product demo = `demo-vo.mp4`, technical walkthrough = `tech-vo.mp4`, then Save draft. Show Tarun before clicking Submit project.
3. Google Form (forms.gle/VS65tsovASMuBwEn9): Solo; team name N/A; email tyadgirkar@gmail.com; name; affiliation (draft said Berkeley); challenge "2. RealPage"; upload the 3 videos; GitHub URL; live demo URL; team picture; T&C. Show Tarun the filled form before Submit (no resubmissions).
4. Optional polish if time allows: shared rate-limit store and an Anthropic spend cap (security review mediums); Newark and Hoboken local rent-control text (ecode360 blocked capture); the `/method` precision caption says 98.3% while the tech video says 0.92 → 0.98 (consistent, just different rounding).
5. Local dev: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<key> npx next dev -p 3000`. The `.env.local` copy of the Maps key was mistyped earlier; the console key ends `…3y8`, and process env overrides the file. Keys live in `.env.local` (Anthropic, ElevenLabs); never commit them. The pipeline's server-side Google geocoding (`geocode.ts`/`rooftop.ts`) needs an unrestricted key and is already done.
