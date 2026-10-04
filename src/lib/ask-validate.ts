import type { AskAnswer } from "./ask-schema";

export const INSUFFICIENT_RECORD = "That's not in the record for this address. Not legal advice.";

const RULE_ID = /\b(r-\d{4}|LIVE-[A-Z]{2}-\d+)\b/g;
const NO_RECORD = /not in the record/i;

export type AskCheck = { ok: true } | { ok: false; problem: string };

// An answer passes only if every rule id it cites or mentions is in the record set, and any answer
// that is not an "insufficient record" reply cites at least one rule.
export function checkAskAnswer(out: AskAnswer, known: ReadonlySet<string>): AskCheck {
  const mentioned = out.answer.match(RULE_ID) ?? [];
  const unknown = [...new Set([...out.cited_rule_ids, ...mentioned])].filter((id) => !known.has(id));
  if (unknown.length) return { ok: false, problem: `cited rule ids not in the record: ${unknown.join(", ")}` };
  const valid = out.cited_rule_ids.filter((id) => known.has(id));
  if (!valid.length && !NO_RECORD.test(out.answer)) return { ok: false, problem: "the answer makes claims about the law but cites no rule id from the record" };
  return { ok: true };
}

export function correctionPrompt(problem: string, known: ReadonlySet<string>): string {
  return `Your answer was rejected: ${problem}. Cite only these rule ids: ${[...known].join(", ") || "(none)"}. Every legal claim must cite one of them in cited_rule_ids. If the record does not answer the question, reply "That's not in the record for this address." and explain what is missing. Answer again.`;
}
