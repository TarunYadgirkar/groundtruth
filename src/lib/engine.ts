import type { Address, CheckRow, Evaluation, LookupResult, Rule, ScheduledValue } from "./types";

export const DEFAULT_AS_OF = "2026-10-01";

type Tri = "yes" | "no" | "unknown";

export interface UnitRange {
  min: number | null;
  max: number | null;
  source: "record" | "use_description" | "none";
}

const WORD_NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

export function unitRange(a: Pick<Address, "units" | "use_code" | "use_description" | "state">): UnitRange {
  const fromDescription = describedUnits(a);
  if (a.units == null) return fromDescription;
  const disagrees =
    (fromDescription.min != null && a.units < fromDescription.min) || (fromDescription.max != null && a.units > fromDescription.max);
  if (disagrees) return { min: Math.min(a.units, fromDescription.min ?? a.units), max: Math.max(a.units, fromDescription.max ?? a.units), source: "use_description" };
  return { min: a.units, max: a.units, source: "record" };
}

function describedUnits(a: Pick<Address, "use_code" | "use_description" | "state">): UnitRange {
  const d = a.use_description.toUpperCase();
  const counts = [...d.matchAll(/(\d+)U\b/g)].map((m) => Number(m[1]));
  if (counts.length) {
    const total = counts.reduce((s, n) => s + n, 0);
    return { min: total, max: total, source: "use_description" };
  }
  const range = d.match(/(\d+)\s*(?:-|TO)\s*(\d+)[\s-]*UNIT/);
  if (range) return { min: Number(range[1]), max: Number(range[2]), source: "use_description" };
  const over = d.match(/>\s*(\d+)[\s-]*UNIT/);
  if (over) return { min: Number(over[1]) + 1, max: null, source: "use_description" };
  const plus = d.match(/(\d+)\s*\+\s*UNITS?|(\d+)\s+UNITS?\s+OR\s+MORE/);
  if (plus) return { min: Number(plus[1] ?? plus[2]), max: null, source: "use_description" };
  const word = d.match(/\b(TWO|THREE|FOUR|FIVE|SIX)\s+OR\s+MORE/);
  if (word) return { min: WORD_NUMBERS[word[1].toLowerCase()], max: null, source: "use_description" };
  const less = d.match(/(\d+)\s+UNITS?\s+OR\s+LESS/);
  if (less) return { min: 1, max: Number(less[1]), source: "use_description" };
  if (a.state === "NJ" && a.use_code === "4C") return { min: 5, max: null, source: "use_description" };
  return { min: null, max: null, source: "none" };
}

export function normalizeDate(d: string | null): string | null {
  if (!d) return null;
  if (/^\d{4}$/.test(d)) return `${d}-01-01`;
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`;
  return d.slice(0, 10);
}

const year = (iso: string) => Number(iso.slice(0, 4));

export function inScope(rule: Rule, a: Address): Tri {
  if (rule.level === "state") return rule.jurisdiction === a.state ? "yes" : "no";
  const [city, st] = rule.jurisdiction.split(", ");
  if (st !== a.state) return "no";
  if (a.legal_city) return a.legal_city === city ? "yes" : "no";
  return a.postal_city === city ? "unknown" : "no";
}

function and(a: Tri, b: Tri): Tri {
  if (a === "no" || b === "no") return "no";
  if (a === "unknown" || b === "unknown") return "unknown";
  return "yes";
}

interface Check {
  covered: Tri;
  reasons: string[];
  rows: CheckRow[];
}

const outcome = (t: Tri): CheckRow["outcome"] => (t === "yes" ? "pass" : t === "no" ? "fail" : "unknown");

function unitsCheck(rule: Rule, units: UnitRange): Check {
  const { min_units, max_units } = rule.coverage;
  if (min_units == null && max_units == null) return { covered: "yes", reasons: [], rows: [] };
  const label = units.source === "record" ? `${units.min} units` : units.source === "use_description" ? `unit count inferred from use code (${units.min ?? "?"}–${units.max ?? "?"})` : "unit count not in records";
  let covered: Tri = "yes";
  if (min_units != null) covered = and(covered, units.min != null && units.min >= min_units ? "yes" : units.max != null && units.max < min_units ? "no" : "unknown");
  if (max_units != null) covered = and(covered, units.max != null && units.max <= max_units ? "yes" : units.min != null && units.min > max_units ? "no" : "unknown");
  const limits = [min_units != null ? `≥${min_units}` : null, max_units != null ? `≤${max_units}` : null].filter(Boolean).join(" and ");
  const building = units.min == null && units.max == null ? "Not in records" : units.min === units.max ? `${units.min}` : `${units.min ?? "?"}–${units.max ?? "?"} (use code)`;
  return { covered, reasons: [`Rule covers buildings with ${limits} units; ${label}.`], rows: [{ fact: "Units", building, requirement: `${limits} units`, outcome: outcome(covered) }] };
}

function cutoffCheck(rule: Rule, built: number | null, asOf: string): Check {
  const c = rule.coverage;
  const basis = c.cutoff_basis === "certificate_of_occupancy" ? "certificate of occupancy" : "construction";
  const reasons: string[] = [];
  let covered: Tri = "yes";
  const needsYear = c.built_before || c.built_on_or_before || c.built_after || c.age_years_exempt != null;
  const rows: CheckRow[] = [];
  if (!needsYear) return { covered, reasons, rows };
  if (built == null) return { covered: "unknown", reasons: ["Coverage depends on the building's age, which is not in the records."], rows: [{ fact: "Year built", building: "Not in records", requirement: "Age cutoff applies", outcome: "unknown" }] };

  const before = c.built_before ?? c.built_on_or_before;
  if (before) {
    const y = year(before);
    const t: Tri = built < y ? "yes" : built > y ? "no" : "unknown";
    covered = and(covered, t);
    rows.push({ fact: c.cutoff_basis === "certificate_of_occupancy" ? "Certificate of occupancy" : "Year built", building: `${built}`, requirement: `${c.built_before ? "Before" : "On or before"} ${before}`, outcome: outcome(t) });
    reasons.push(
      t === "unknown"
        ? `Built ${built}, the same year as the ${before} ${basis} cutoff; the exact date is not in the records.`
        : `Built ${built}; rule covers ${basis} ${c.built_before ? "before" : "on or before"} ${before}.`,
    );
  }
  if (c.built_after) {
    const y = year(c.built_after);
    const t: Tri = built > y ? "yes" : built < y ? "no" : "unknown";
    covered = and(covered, t);
    rows.push({ fact: "Year built", building: `${built}`, requirement: `After ${c.built_after}`, outcome: outcome(t) });
    reasons.push(`Built ${built}; rule covers ${basis} after ${c.built_after}.`);
  }
  if (c.age_years_exempt != null) {
    const age = year(asOf) - built;
    const t: Tri = age > c.age_years_exempt + 1 ? "yes" : age < c.age_years_exempt ? "no" : "unknown";
    covered = and(covered, t);
    rows.push({ fact: "Building age", building: `${age} years`, requirement: `Older than ${c.age_years_exempt} years`, outcome: outcome(t) });
    reasons.push(
      t === "no"
        ? `Built ${built}; buildings with a ${basis} within ${c.age_years_exempt} years are exempt.`
        : t === "unknown"
          ? `Built ${built}; near the ${c.age_years_exempt}-year new-construction exemption and the ${basis} date is not in the records.`
          : `Built ${built}; older than the ${c.age_years_exempt}-year new-construction exemption.`,
    );
  }
  return { covered, reasons, rows };
}

function ownerCheck(rule: Rule, units: UnitRange): Check {
  if (!rule.coverage.owner_type_dependent) return { covered: "yes", reasons: [], rows: [] };
  const cap = rule.coverage.owner_exemption_max_units;
  if (cap != null && units.min != null && units.min > cap)
    return { covered: "yes", reasons: [`The owner-type exception only reaches buildings of ${cap} or fewer units; this one has at least ${units.min}.`], rows: [{ fact: "Owner type", building: "Not in records", requirement: `Exception only for ≤${cap} units`, outcome: "pass" }] };
  return { covered: "unknown", reasons: ["Coverage depends on the owner type or owner occupancy, which the records deliberately omit."], rows: [{ fact: "Owner type", building: "Not in records", requirement: "Depends on owner", outcome: "unknown" }] };
}

// Coverage that turns on a fact public records lack (a subsidy program, a condo conversion, a demolition)
// cannot be confirmed, so the rule is unknown rather than applies.
function populationCheck(rule: Rule): Check {
  const note = rule.coverage.unverifiable_conditions ?? "";
  const restricted = /^RESTRICTED:/i.test(note);
  if (!restricted && !rule.coverage.depends_on_unknown_fact) return { covered: "yes", reasons: [], rows: [] };
  const condition = note.replace(/^RESTRICTED:\s*/i, "") || "a condition not in the records";
  return {
    covered: "unknown",
    reasons: [restricted ? `Covers only ${condition}; program participation is not in the records.` : `Coverage depends on ${condition}, which is not in the records.`],
    rows: [{ fact: restricted ? "Program / subsidy" : "Other condition", building: "Not in records", requirement: condition, outcome: "unknown" }],
  };
}

function evaluateOne(rule: Rule, a: Address, asOf: string): { result: LookupResult; reasons: string[]; rows: CheckRow[] } | null {
  const scope = inScope(rule, a);
  if (scope === "no" || rule.status === "failed") return null;
  const units = unitRange(a);
  const reasons: string[] = [];
  if (scope === "unknown") reasons.push(`Legal city could not be confirmed; mailing city is ${a.postal_city}.`);

  const checks = [unitsCheck(rule, units), cutoffCheck(rule, a.year_built, asOf), ownerCheck(rule, units), populationCheck(rule)];
  const covered = checks.reduce<Tri>((acc, c) => and(acc, c.covered), scope === "unknown" ? "unknown" : "yes");
  for (const c of checks) reasons.push(...c.reasons);
  if (covered === "no") return null;
  const place = rule.level === "state" ? a.state : (a.legal_city ?? `${a.postal_city} (postal)`);
  const rows: CheckRow[] = [{ fact: "Jurisdiction", building: place, requirement: rule.jurisdiction, outcome: outcome(scope) }, ...checks.flatMap((c) => c.rows)];

  if (rule.status === "pending") return { result: "pending", reasons: ["Pending bill or proposal; not law.", ...reasons], rows };

  const eff = normalizeDate(rule.effective_date);
  if (eff && eff > asOf) return { result: "not_yet_effective", reasons: [`Enacted; takes effect ${eff}.`, ...reasons], rows: [...rows, { fact: "Effective date", building: asOf, requirement: `On or after ${eff}`, outcome: "fail" }] };
  if (!eff && rule.status === "not_yet_effective") return { result: "not_yet_effective", reasons: ["Enacted; not yet in effect.", ...reasons], rows };
  if (eff) {
    reasons.unshift(`In effect since ${eff}.`);
    rows.push({ fact: "Effective date", building: asOf, requirement: `On or after ${eff}`, outcome: "pass" });
  }

  return { result: covered === "unknown" ? "unknown" : "applies", reasons, rows };
}

export interface ValueAt {
  value: string | null;
  entry: ScheduledValue | null;
  scheduled: boolean;
  // The rule's requirement and main quote are written for one period (the default as-of date). When the
  // as-of date picks a different figure, textEntry is the period that static text describes.
  textDiffers: boolean;
  textEntry: ScheduledValue | null;
}

const figures = (s: string): string[] => s.match(/\d[\d,]*(\.\d+)?/g) ?? [];

function entryAt(schedule: ScheduledValue[], asOf: string): ScheduledValue | null {
  return schedule.find((e) => (!e.from || normalizeDate(e.from)! <= asOf) && (!e.to || normalizeDate(e.to)! >= asOf)) ?? null;
}

// Dated values (annual allowable increases, relocation amounts, interest rates) come from the rule's
// value_schedule; outside every stated interval the value is unknown rather than the latest one.
export function valueAt(rule: Pick<Rule, "key_value" | "value_schedule">, asOf: string): ValueAt {
  const schedule = rule.value_schedule ?? [];
  if (!schedule.length) return { value: rule.key_value, entry: null, scheduled: false, textDiffers: false, textEntry: null };
  const entry = entryAt(schedule, asOf);
  const textDiffers = !entry || !figures(entry.value).every((n) => (rule.key_value ?? "").includes(n));
  return { value: entry?.value ?? null, entry, scheduled: true, textDiffers, textEntry: textDiffers ? entryAt(schedule, DEFAULT_AS_OF) : null };
}

export function evaluateAddress(address: Address, rules: Rule[], asOf: string = DEFAULT_AS_OF): Evaluation[] {
  const raw = rules
    .map((rule) => ({ rule, out: evaluateOne(rule, address, asOf) }))
    .filter((x): x is { rule: Rule; out: NonNullable<ReturnType<typeof evaluateOne>> } => x.out !== null);

  const localApplies = new Set(raw.filter((x) => x.rule.level === "city" && x.out.result === "applies").map((x) => x.rule.category));
  const localUnknown = new Set(raw.filter((x) => x.rule.level === "city" && x.out.result === "unknown").map((x) => x.rule.category));
  const active = new Set(raw.filter((x) => x.out.result !== "pending").map((x) => x.rule.team_rule_id));

  return raw.map(({ rule, out }) => {
    let result = out.result;
    const reasons = [...out.reasons];
    if (rule.yields_to_local && result === "applies" && localApplies.has(rule.category)) {
      result = "superseded";
      reasons.unshift("A stricter local rule in the same category covers this building and governs instead.");
    } else if (rule.yields_to_local && result === "applies" && localUnknown.has(rule.category)) {
      result = "unknown";
      reasons.unshift("Applies only if local rent control does not cover the building, and local coverage is unknown.");
    }
    const conflicts = rule.conflicts_with.filter((id) => active.has(id));
    if (conflicts.length) reasons.push(`Possible conflict with ${conflicts.join(", ")}; flagged for human review.`);
    return {
      team_rule_id: rule.team_rule_id,
      result,
      explanation: reasons.join(" "),
      conflict_flag: conflicts.length > 0,
      checks: out.rows,
    };
  });
}
