import fs from "node:fs";
import path from "node:path";
import { DATA, ROOT, writeJson } from "./lib/corpus";
import { DEFAULT_AS_OF, evaluateAddress } from "../src/lib/engine";
import type { Address, Evaluation, Rule } from "../src/lib/types";

const OUT = path.join(ROOT, "submission");
const rules: Rule[] = JSON.parse(fs.readFileSync(path.join(DATA, "rules.json"), "utf8"));
const addresses: Address[] = JSON.parse(fs.readFileSync(path.join(DATA, "addresses.json"), "utf8"));

const evalAt = (a: Address, asOf: string, subset: Rule[] = rules) => evaluateAddress(a, subset, asOf);
const resultOf = (evals: Evaluation[], id: string) => evals.find((e) => e.team_rule_id === id)?.result ?? "not_applicable";

const cite = (r: Rule) => `${r.citation} ${r.title}`.toLowerCase();
const alg = (r: Rule) => r.category === "algorithmic_rent_setting";

const selectors: Record<string, (r: Rule) => boolean> = {
  T1: (r) => alg(r) && r.jurisdiction === "CA" && /16729|ab 325|sb 763|common pricing/.test(cite(r)),
  T2: (r) => alg(r) && (r.jurisdiction === "Hoboken, NJ" || r.jurisdiction === "Jersey City, NJ"),
  T3: (r) => alg(r) && r.jurisdiction === "NJ" && /fair|2026, c\.? ?43|p\.l\.2026/.test(cite(r)),
  T4: (r) => alg(r) && r.jurisdiction === "MA" && r.status === "pending",
  T5: (r) => r.category === "rent_increase_limits" && r.jurisdiction === "MA" && r.status === "failed",
};

interface Change {
  affected_address_ids: string[];
  conflict_flag_address_ids: string[];
  notes: string;
  rule_ids: string[];
  before_after: Record<string, Record<string, { before: string; after: string }>>;
}

function transition(selected: Rule[], before: string, after: string): Change {
  const affected: string[] = [];
  const conflicts: string[] = [];
  const before_after: Change["before_after"] = {};
  for (const a of addresses) {
    const b = evalAt(a, before);
    const f = evalAt(a, after);
    const diff: Record<string, { before: string; after: string }> = {};
    for (const r of selected) {
      const rb = resultOf(b, r.team_rule_id);
      const ra = resultOf(f, r.team_rule_id);
      if (rb !== ra) diff[r.team_rule_id] = { before: rb, after: ra };
    }
    if (Object.keys(diff).length) {
      affected.push(a.address_id);
      before_after[a.address_id] = diff;
    }
    if (selected.some((r) => b.concat(f).some((e) => e.team_rule_id === r.team_rule_id && e.conflict_flag))) conflicts.push(a.address_id);
  }
  return { affected_address_ids: affected, conflict_flag_address_ids: conflicts, notes: "", rule_ids: selected.map((r) => r.team_rule_id), before_after };
}

function presence(selected: Rule[], asOf: string, results: string[]): Change {
  const affected: string[] = [];
  const conflicts: string[] = [];
  const before_after: Change["before_after"] = {};
  for (const a of addresses) {
    const ev = evalAt(a, asOf).filter((e) => selected.some((r) => r.team_rule_id === e.team_rule_id));
    const hits = ev.filter((e) => results.includes(e.result));
    if (hits.length) {
      affected.push(a.address_id);
      before_after[a.address_id] = Object.fromEntries(hits.map((e) => [e.team_rule_id, { before: e.result, after: e.result }]));
    }
    if (ev.some((e) => e.conflict_flag)) conflicts.push(a.address_id);
  }
  return { affected_address_ids: affected, conflict_flag_address_ids: conflicts, notes: "", rule_ids: selected.map((r) => r.team_rule_id), before_after };
}

function main(): void {
  fs.mkdirSync(OUT, { recursive: true });
  writeJson(path.join(OUT, "rules.json"), { rules });

  const lookups = Object.fromEntries(addresses.map((a) => [a.address_id, evalAt(a, DEFAULT_AS_OF).map(({ checks: _c, ...e }) => e)]));
  writeJson(path.join(OUT, "lookups.json"), { as_of: DEFAULT_AS_OF, lookups });

  const pick = (t: string) => rules.filter(selectors[t]);
  const t1 = transition(pick("T1"), "2025-12-31", "2026-01-02");
  t1.notes = "CA AB 325 / SB 763: not_yet_effective on 2025-12-31, applies on 2026-01-02 for California addresses.";
  const t2 = presence(pick("T2"), DEFAULT_AS_OF, ["applies", "unknown"]);
  t2.notes = "Hoboken ban only inside Hoboken, Jersey City ban only inside Jersey City (legal city from Census geocoding), neither in Newark.";
  const t3 = transition(pick("T3"), DEFAULT_AS_OF, "2027-07-02");
  t3.notes = "NJ FAIR Act: not_yet_effective on 2026-10-01, applies on 2027-07-02; Jersey City and Hoboken addresses flagged for possible preemption conflict with local bans.";
  const t4 = presence(pick("T4"), DEFAULT_AS_OF, ["pending"]);
  t4.notes = "S.2983 / H.5222 reported as pending (not law); affected set = MA addresses that would be covered if enacted.";
  const t5 = presence(rules.filter((r) => r.category === "rent_increase_limits" && r.jurisdiction.endsWith("MA")), DEFAULT_AS_OF, ["applies", "unknown", "not_yet_effective"]);
  t5.notes = `Struck ballot question recorded as failed (${pick("T5").map((r) => r.team_rule_id).join(", ") || "no failed record found"}); no rent cap reported for Boston or Cambridge.`;
  t5.rule_ids = pick("T5").map((r) => r.team_rule_id);

  const changes = { T1: t1, T2: t2, T3: t3, T4: t4, T5: t5 };
  writeJson(path.join(OUT, "changes.json"), changes);
  writeJson(path.join(ROOT, "src/data/changes.json"), changes);

  const counts: Record<string, number> = {};
  for (const evals of Object.values(lookups)) for (const e of evals) counts[e.result] = (counts[e.result] ?? 0) + 1;
  console.log("lookup results", counts, "addresses with ≥1 rule", Object.values(lookups).filter((e) => e.length).length);
  for (const [k, v] of Object.entries(changes)) console.log(k, "rules", v.rule_ids.join(","), "affected", v.affected_address_ids.length, "conflicts", v.conflict_flag_address_ids.length);
}

main();
