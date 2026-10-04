import { ADDRESSES, RULES, SOURCES_RETRIEVED } from "./data";

// Figures shown on /method. `null` renders as "pending" so a missing number never looks real.
// Accuracy figures come from the round-2 audit (data/audit.md); round 3 scored 1.000 on the same sample that guided fixes.
export const METHOD_STATS = {
  documentsInCorpus: 73,
  rulesExtracted: RULES.length,
  quotesChecked: 206 as number | null,
  quotesDropped: 0 as number | null,
  addressesTotal: ADDRESSES.length,
  addressesPlaced: ADDRESSES.filter((a) => a.legal_city !== null).length,
  checkSetSize: 27 as number | null,
  precision: 0.983 as number | null,
  recall: 0.983 as number | null,
  retrievedOn: SOURCES_RETRIEVED,
  model: "Claude (claude-opus-5-5)",
};
