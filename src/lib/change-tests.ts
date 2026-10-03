import changesJson from "@/data/changes.json";
import { ADDRESSES, ruleById } from "./data";
import type { Address, LookupResult, Rule } from "./types";

interface RawChange {
  affected_address_ids: string[];
  conflict_flag_address_ids: string[];
  notes: string;
  rule_ids: string[];
  before_after?: Record<string, Record<string, { before: LookupResult | null; after: LookupResult | null }>>;
}

interface TestMeta {
  id: string;
  title: string;
  question: string;
  before: string | null;
  after: string;
}

// Titles and dates mirror starter/dev/change_tests.json.
const META: TestMeta[] = [
  { id: "T1", title: "California AB 325 / SB 763 takes effect", question: "Which buildings gain the algorithmic pricing ban on Jan 1, 2026?", before: "2025-12-31", after: "2026-01-02" },
  { id: "T2", title: "Hoboken vs Jersey City local algorithmic bans", question: "Which buildings fall inside each city's own ban?", before: null, after: "2026-10-01" },
  { id: "T3", title: "New Jersey FAIR Act: enacted, not yet in effect", question: "Who is covered once the state act starts, and where might it preempt local bans?", before: "2026-10-01", after: "2027-07-02" },
  { id: "T4", title: "Massachusetts pending bills S.2983 and H.5222", question: "Which buildings would be covered if these bills passed?", before: null, after: "2026-10-01" },
  { id: "T5", title: "Massachusetts rent-control ballot question struck", question: "Does any Boston or Cambridge building get a rent cap?", before: null, after: "2026-10-01" },
];

export interface ChangeTest extends TestMeta {
  notes: string;
  rules: Rule[];
  affected: Address[];
  conflicts: Set<string>;
  total: number;
}

const BY_ID = new Map(ADDRESSES.map((a) => [a.address_id, a]));
const RAW = changesJson as unknown as Record<string, RawChange>;

export const CHANGE_TESTS: ChangeTest[] = META.map((m) => {
  const raw = RAW[m.id];
  return {
    ...m,
    notes: raw?.notes ?? "",
    rules: (raw?.rule_ids ?? []).map((id) => ruleById(id)).filter((r): r is Rule => !!r),
    affected: (raw?.affected_address_ids ?? []).map((id) => BY_ID.get(id)).filter((a): a is Address => !!a),
    conflicts: new Set(raw?.conflict_flag_address_ids ?? []),
    total: ADDRESSES.length,
  };
});

export function groupByCity(list: Address[]): [string, Address[]][] {
  const m = new Map<string, Address[]>();
  for (const a of list) {
    const key = `${a.legal_city ?? a.postal_city}, ${a.state}`;
    m.set(key, [...(m.get(key) ?? []), a]);
  }
  return [...m.entries()].sort((x, y) => y[1].length - x[1].length);
}
