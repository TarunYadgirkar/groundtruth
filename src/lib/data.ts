import type { Address, Evaluation, Rule } from "./types";

// Data source. Addresses are real pipeline output. To switch rules and the engine
// to real output, point the next two imports at "@/data/rules.json" and "./engine".
import addressesJson from "@/data/addresses.json";
import rulesJson from "@/data/mock/rules.json";
import { evaluateAddress } from "./mock-engine";

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
