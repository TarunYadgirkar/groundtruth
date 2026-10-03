import { SealCheckIcon } from "@phosphor-icons/react";
import type { IngestedRule } from "@/lib/ingest";
import { formatDate } from "@/lib/labels";
import type { RuleStatus } from "@/lib/types";

const STATUS: Record<RuleStatus, { label: string; bg: string; fg: string }> = {
  in_force: { label: "In force", bg: "var(--st-applies-bg)", fg: "var(--st-applies-fg)" },
  not_yet_effective: { label: "Not yet in effect", bg: "var(--st-nye-bg)", fg: "var(--st-nye-fg)" },
  pending: { label: "Pending bill", bg: "var(--st-pending-bg)", fg: "var(--st-pending-fg)" },
  failed: { label: "Failed", bg: "var(--st-unknown-bg)", fg: "var(--st-unknown-fg)" },
};

export default function IngestedRuleCard({ rule, category }: { rule: IngestedRule; category: string }) {
  const s = STATUS[rule.status];
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-surface p-4 shadow-[0_0_0_1px_var(--hairline)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-ink-muted">
            {rule.jurisdiction} · {category}
          </p>
          <h4 className="mt-1 text-ui font-bold text-ink">{rule.title}</h4>
          <p className="mt-0.5 font-mono text-[0.75rem] text-ink-muted">{rule.citation}</p>
        </div>
        <span className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[0.75rem] font-bold" style={{ backgroundColor: s.bg, color: s.fg }}>
          {s.label}
        </span>
      </div>
      <p className="max-w-[70ch] text-ui text-ink">{rule.requirement}</p>
      <blockquote className="relative rounded-[var(--radius-chip)] bg-surface-sunk py-2.5 pl-4 pr-3">
        <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-ink/70" />
        <span className="eyebrow mb-1 flex items-center gap-1.5 text-ink-muted">
          Source text, quoted exactly
          {rule.quote_verified && (
            <span className="inline-flex items-center gap-1 text-contour">
              · quote verified <SealCheckIcon size={12} weight="fill" aria-hidden />
            </span>
          )}
        </span>
        <p className="font-mono text-[0.8125rem] leading-[1.55] text-ink">“{rule.quoted_span}”</p>
      </blockquote>
      <dl className="grid gap-x-6 gap-y-2 text-caption sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-muted">Effective</dt>
        <dd className="tnum text-ink">{rule.effective_date ? formatDate(rule.effective_date) : "Not stated in the text"}</dd>
        <dt className="text-ink-muted">Covers</dt>
        <dd className="text-ink">{rule.coverage_conditions}</dd>
        {rule.exemptions && (
          <>
            <dt className="text-ink-muted">Exempt</dt>
            <dd className="text-ink">{rule.exemptions}</dd>
          </>
        )}
      </dl>
    </li>
  );
}
