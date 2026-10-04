import assert from "node:assert/strict";
import { checkAskAnswer } from "../src/lib/ask-validate";

const known = new Set(["r-0016", "r-0019"]);
const base = { ui_actions: [] };
const cases: [string, Parameters<typeof checkAskAnswer>[0], boolean][] = [
  ["valid citation", { ...base, answer: "Rent increases are capped at 5% + CPI (r-0016). Not legal advice.", cited_rule_ids: ["r-0016"] }, true],
  ["unknown cited id", { ...base, answer: "The cap is 5% + CPI. Not legal advice.", cited_rule_ids: ["r-0099"] }, false],
  ["unknown id in prose only", { ...base, answer: "See r-0042 for the cap. Not legal advice.", cited_rule_ids: ["r-0016"] }, false],
  ["mixed valid and invalid", { ...base, answer: "Deposits are capped. Not legal advice.", cited_rule_ids: ["r-0019", "r-0777"] }, false],
  ["legal claim with no citation", { ...base, answer: "Your landlord cannot raise rent more than 10%. Not legal advice.", cited_rule_ids: [] }, false],
  ["insufficient record reply", { ...base, answer: "That's not in the record for this address. The unit count is unknown. Not legal advice.", cited_rule_ids: [] }, true],
  ["invented live id", { ...base, answer: "LIVE-CA-3 bans this. Not legal advice.", cited_rule_ids: ["LIVE-CA-3"] }, false],
];
for (const [name, out, expected] of cases) {
  const got = checkAskAnswer(out, known);
  assert.equal(got.ok, expected, `${name}: ${JSON.stringify(got)}`);
  console.log(`ok  ${name}${got.ok ? "" : ` -> ${got.problem}`}`);
}
