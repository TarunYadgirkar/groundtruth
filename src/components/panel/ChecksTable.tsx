import { CheckIcon, QuestionIcon, XIcon } from "@phosphor-icons/react";
import { STATUS_LABEL } from "@/lib/labels";
import type { CheckRow, Evaluation } from "@/lib/types";
import { STATUS_STYLE } from "./StatusPill";

const OUTCOME = {
  pass: { Icon: CheckIcon, label: "meets", color: "var(--st-applies-fg)", bg: "var(--st-applies-bg)" },
  fail: { Icon: XIcon, label: "does not meet", color: "var(--accent-ink)", bg: "var(--accent-wash)" },
  unknown: { Icon: QuestionIcon, label: "unknown", color: "var(--st-unknown-fg)", bg: "var(--st-unknown-bg)" },
} as const;

function deciding(checks: CheckRow[]): CheckRow | undefined {
  return checks.find((c) => c.outcome === "unknown") ?? checks.find((c) => c.outcome === "fail");
}

function verdict(evaluation: Evaluation, checks: CheckRow[]): string {
  const d = deciding(checks);
  if (evaluation.result === "unknown" && d) return `the ${d.fact.toLowerCase()} is not in public records`;
  return evaluation.explanation;
}

export default function ChecksTable({ evaluation }: { evaluation: Evaluation }) {
  const checks = evaluation.checks ?? [];
  const status = STATUS_STYLE[evaluation.result];

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-chip)] bg-paper px-3 py-2.5">
      <span className="eyebrow text-ink-muted">Why this result</span>
      {checks.length > 0 && (
        <table className="w-full table-fixed border-collapse text-caption">
          <thead>
            <tr className="text-left text-ink-muted">
              <th scope="col" className="w-[30%] pb-1 font-normal">Fact</th>
              <th scope="col" className="w-[33%] pb-1 font-normal">This building</th>
              <th scope="col" className="pb-1 font-normal">Rule requires</th>
              <th scope="col" className="w-6 pb-1">
                <span className="sr-only">Outcome</span>
              </th>
            </tr>
          </thead>
          <tbody className="align-top">
            {checks.map((c) => {
              const o = OUTCOME[c.outcome];
              return (
                <tr key={c.fact} className="border-t border-hairline">
                  <th scope="row" className="py-1.5 pr-2 text-left font-bold text-ink">{c.fact}</th>
                  <td className={`tnum py-1.5 pr-2 break-words ${c.outcome === "unknown" ? "text-ink-muted italic" : "text-ink"}`}>{c.building}</td>
                  <td className="py-1.5 pr-2 break-words text-ink">{c.requirement}</td>
                  <td className="py-1.5">
                    <span className="grid size-5 place-items-center rounded-full" style={{ backgroundColor: o.bg, color: o.color }} title={o.label}>
                      <o.Icon size={11} weight="bold" aria-hidden />
                      <span className="sr-only">{o.label}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-caption text-ink">
        <strong className="eyebrow mr-1.5 font-bold" style={{ color: status.fg }}>
          {STATUS_LABEL[evaluation.result]}
        </strong>
        {verdict(evaluation, checks)}
      </p>
      {checks.length > 0 && evaluation.result === "unknown" && <p className="text-caption text-ink-muted">{evaluation.explanation}</p>}
    </div>
  );
}
