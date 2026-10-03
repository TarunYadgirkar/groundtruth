import { ADDRESSES, RULES } from "./data";

// Figures shown on /method. `null` renders as "pending" so a missing number never looks real.
// TODO: fill quotesChecked, quotesDropped, precision, recall, checkSetSize from pipeline/evaluate.ts output.
export const METHOD_STATS = {
  documentsInCorpus: 87,
  rulesExtracted: RULES.length,
  quotesChecked: null as number | null,
  quotesDropped: null as number | null,
  addressesTotal: ADDRESSES.length,
  addressesGeocoded: ADDRESSES.filter((a) => a.lat !== null).length,
  checkSetSize: null as number | null,
  precision: null as number | null,
  recall: null as number | null,
  retrievedOn: "2026-10-01",
  model: "Claude (claude-opus-5-5)",
};
