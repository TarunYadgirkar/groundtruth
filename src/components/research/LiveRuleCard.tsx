import { ArrowSquareOutIcon, CheckCircleIcon, FlaskIcon } from "@phosphor-icons/react";
import { CATEGORIES, formatDate } from "@/lib/labels";
import type { LiveRule } from "@/lib/live-research";
import type { Evaluation } from "@/lib/types";
import ChecksTable from "../panel/ChecksTable";
import StatusPill from "../panel/StatusPill";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function safeHref(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export function LiveBadge() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-live-wash px-2.5 text-[0.75rem] font-bold text-live-ink">
      <FlaskIcon size={12} weight="bold" aria-hidden />
      Live research · unverified by counsel
    </span>
  );
}

export default function LiveRuleCard({ rule, evaluation }: { rule: LiveRule; evaluation: Evaluation | undefined }) {
  const href = safeHref(rule.source_url);
  const category = CATEGORIES.find((c) => c.id === rule.category)?.label ?? rule.category;
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-surface px-4 py-3 shadow-[0_0_0_1px_var(--hairline),0_1px_2px_rgba(30,43,38,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-ink-muted">
            {category} · {rule.level === "city" ? "City" : "State"}
          </p>
          <h4 className="mt-0.5 text-ui font-bold text-ink">{rule.title}</h4>
          <p className="mt-0.5 break-words font-mono text-[0.75rem] text-ink-muted">{rule.citation}</p>
        </div>
        {evaluation && <StatusPill result={evaluation.result} />}
      </div>

      <LiveBadge />

      <p className="text-ui text-ink">{rule.requirement}</p>

      <blockquote className="relative rounded-[var(--radius-chip)] bg-surface-sunk py-2.5 pl-4 pr-3 text-ui text-ink">
        <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-live" />
        <p className="font-mono text-[0.8125rem] leading-[1.55]">“{rule.quoted_span.replace(/\s+/g, " ")}”</p>
        <p className="mt-1.5 flex items-center gap-1 text-caption text-[var(--st-applies-fg)]">
          <CheckCircleIcon size={14} weight="fill" aria-hidden />
          Quote found on fetched page ✓
        </p>
      </blockquote>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.75rem] text-ink-muted">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-ink">
            Source: {host(href)} <ArrowSquareOutIcon size={12} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <span>{host(rule.source_url)}</span>
        )}
        <span className="tnum">Fetched {formatDate(rule.fetched_at)}</span>
        {rule.effective_date && <span className="tnum">Effective {formatDate(rule.effective_date)}</span>}
        <span className="tnum">Confidence {Math.round(rule.confidence * 100)}%</span>
        {!rule.official_source && <span className="font-sans text-caption">Unofficial copy of the law. Check the official code before relying on it.</span>}
      </div>

      {evaluation && <ChecksTable evaluation={evaluation} />}
    </li>
  );
}
