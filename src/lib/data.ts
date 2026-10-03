import type { Address, Evaluation, Rule } from "./types";

// Data source: pipeline output. For offline UI work, swap these three imports to
// "@/data/mock/addresses.json", "@/data/mock/rules.json" and "./mock-engine".
import addressesJson from "@/data/addresses.json";
import rulesJson from "@/data/rules.json";
import { evaluateAddress } from "./engine";

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export const ADDRESSES: Address[] = (addressesJson as Address[]).map((a) => ({ ...a, street_address: titleCase(a.street_address) }));
export const RULES = rulesJson as unknown as Rule[];

const RULES_BY_ID = new Map(RULES.map((r) => [r.team_rule_id, r]));

export function ruleById(id: string): Rule | undefined {
  return RULES_BY_ID.get(id);
}

export function evaluate(address: Address, asOf: string): Evaluation[] {
  return evaluateAddress(address, RULES, asOf);
}

export function rulesForPlace(address: Address): Rule[] {
  const city = `${address.legal_city}, ${address.state}`;
  return RULES.filter((r) => r.jurisdiction === address.state || r.jurisdiction === city);
}
