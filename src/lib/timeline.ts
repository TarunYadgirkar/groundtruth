import { evaluate, rulesForPlace } from "./data";
import { isIsoDay } from "./labels";
import type { Address, LookupResult, Rule } from "./types";

export interface ChangeEvent {
  date: string;
  rule: Rule;
  before: LookupResult | null;
  after: LookupResult | null;
}

function resultsAt(address: Address, asOf: string): Map<string, LookupResult> {
  return new Map(evaluate(address, asOf).map((e) => [e.team_rule_id, e.result]));
}

export function changesBetween(address: Address, from: string, to: string): ChangeEvent[] {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const rules = rulesForPlace(address);
  const byId = new Map(rules.map((r) => [r.team_rule_id, r]));
  const boundaries = [...new Set(rules.map((r) => r.effective_date).filter(isIsoDay))].filter((d) => d > start && d <= end).sort();
  const events: ChangeEvent[] = [];
  let prev = resultsAt(address, start);
  for (const date of [...boundaries, end]) {
    const next = resultsAt(address, date);
    for (const id of new Set([...prev.keys(), ...next.keys()])) {
      const before = prev.get(id) ?? null;
      const after = next.get(id) ?? null;
      const rule = byId.get(id);
      if (before !== after && rule) events.push({ date, rule, before, after });
    }
    prev = next;
  }
  return events;
}
