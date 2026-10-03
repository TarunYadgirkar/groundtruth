# Groundtruth: build plan

RealPage challenge: Rental Housing Law Navigator. Solo. Submit by **Oct 4, 4:30 AM PT**; the hard deadline is 6:00 AM.

## What we ship
- `out/rules.json`, `out/lookups.json` (all 500 addresses), `out/changes.json` (T1–T5), and `METHOD.md` (one page)
- A hosted demo on Vercel, a public GitHub repo with a README, and three videos of up to 60 s each
- Submitted on HackOS (solo team) and through the Google Form

## Architecture (one pnpm repo, TypeScript strict)

```
realpage/
  starter/            organizer pack, read-only
  pipeline/           Node scripts run with tsx
    extract.ts        Claude reads each corpus doc → rule records plus structured coverage
    verify.ts         quoted_span must appear verbatim (after normalizing whitespace) in the source; failures are dropped and logged
    geocode.ts        Census batch geocoder → legal place, county, lat/lng per address
    engine.ts         deterministic: (rule, building facts, place, asOf) → result
    lookups.ts        engine × 500 addresses at 2026-10-01
    changes.ts        T1–T5 from the same engine
    evaluate.ts       compare against a hand-labeled 30-address check set
  data/               generated JSON consumed by the web app
  out/                submission JSON
  web/                Next.js app (Vercel)
```

### Rule records carry a machine-checkable coverage block
In addition to the required schema fields, the extractor emits:
```ts
coverage: {
  scope: { level: 'state' | 'city'; jurisdiction: string }
  minUnits?: number; maxUnits?: number
  builtBefore?: string        // ISO date; set certOfOccupancy=true when the cutoff is a CO date
  builtAfterOrOn?: string
  certOfOccupancy?: boolean
  ownerTypeDependent?: boolean
  useCodes?: string[]
}
effective_date, status, supersedes: [team_rule_id], conflictsWith: [team_rule_id]
```

### Engine rules, in order
1. Jurisdiction mismatch → omit.
2. `status=pending` → `pending`. `failed` → omit, logged for T5.
3. effective_date > asOf → `not_yet_effective`.
4. A coverage fact is missing, falls in the cutoff year for a CO date, or depends on owner type → `unknown`.
5. Covered, and a stricter local rule in the same category applies → `superseded`.
6. Otherwise → `applies`. `conflict_flag` is set when a conflictsWith target is also active or will become active.

### Accuracy
There's no answer key, so I hand-label 30 addresses across the 9 cities (rules plus expected results) and report precision and recall in METHOD.md and in the tech video. Tests stay lean: engine unit tests plus T1–T5 assertions.

## Web app (direction B: daylight cartographic, being revised)
1. **Landing:** name, a large search bar with typing animation, suggestions from the 500 addresses plus Google Places autocomplete.
2. **Fly-in:** Google Maps 3D (`@vis.gl/react-google-maps` Map3D). `flyCameraTo` from globe altitude to about 250 m, tilt 65°, then `flyCameraAround`.
3. **Answer panel:** jurisdiction stack (including "postal Dorchester → legal Boston"), building facts with missing ones shown, rules grouped by category with status pills, an expandable quote with citation, source URL and retrieval date, and conflict flags.
4. **Time slider:** scrubbing the as-of date re-runs the engine client-side (the engine is shared code), with tick marks at effective dates.
5. **/method:** pipeline diagram, audit log, the quote-verification count, and accuracy figures. A "not legal advice" banner appears on every page.
6. Addresses outside the sample: geocode them live and show rules for that jurisdiction, with building facts marked unknown.

## Timeline (PT)
| When | Pipeline (me) | Web (parallel agent) |
|---|---|---|
| now–3:00 | repo, env, extraction prompt, run on 3 docs | scaffold Next, tokens, landing |
| 3:00–6:00 | full extraction + verify, geocode | search, Map3D fly-in |
| 6:00–9:00 | engine, lookups, T1–T5 | answer panel, slider |
| 9:00–11:00 | hand-label 30, evaluate, fix | /method page, polish |
| 11:00–1:00 | integrate, deploy, README, METHOD.md | |
| 1:00–3:30 | three videos, team photo | |
| 3:30–4:30 | HackOS team + submit, Google Form | |

## Keys (.env.local, never committed)
`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## Risks
- Extraction misses rules, which is costly because a missed rule costs double. Mitigation: a second pass per jurisdiction that asks "which of the six categories have no rule?", and a check that each city and category has coverage.
- Census geocoder misses → fall back to Google Geocoding.
- Map3D is heavy or blocked → fall back to Cesium ion with Google tiles.
