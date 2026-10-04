"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowSquareOutIcon, CaretDownIcon, FlagIcon, ScalesIcon } from "@phosphor-icons/react";
import { ruleById } from "@/lib/data";
import { valueAt } from "@/lib/engine";
import { formatDate } from "@/lib/labels";
import type { Evaluation, Rule, ScheduledValue } from "@/lib/types";
import ChecksTable from "./ChecksTable";
import StatusPill from "./StatusPill";

interface RuleRowProps {
  rule: Rule;
  evaluation: Evaluation;
  highlight: number | null;
  placeIds: ReadonlySet<string>;
  asOf: string;
}

function safeUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function sourceLabel(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function conflictTargets(rule: Rule, placeIds: ReadonlySet<string>): string {
  return rule.conflicts_with
    .filter((id) => placeIds.has(id))
    .map((id) => ruleById(id)?.title ?? id)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
}

function periodLabel(from: string | null, to: string | null): string {
  if (from && to) return `${formatDate(from)} to ${formatDate(to)}`;
  return from ? `from ${formatDate(from)}` : `until ${formatDate(to!)}`;
}

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <blockquote className="relative rounded-[var(--radius-chip)] bg-surface-sunk py-2.5 pl-4 pr-3 text-ui text-ink">
      <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-ink/70" />
      <span className="eyebrow mb-1 block text-ink-muted">{label}</span>
      <p className="font-mono text-[0.8125rem] leading-[1.55]">“{text}”</p>
    </blockquote>
  );
}

function entryLabel(entry: ScheduledValue, ruleDocId: string | null): string {
  const doc = entry.source_doc_id && entry.source_doc_id !== ruleDocId ? ` (${entry.source_doc_id})` : "";
  return `${entry.value} applies ${periodLabel(entry.from, entry.to)}${doc}`;
}

function periodNote(selected: ScheduledValue | null, textEntry: ScheduledValue | null): string {
  const lead = selected ? "Rate shown above is for the selected date" : "No rate is stated for the selected date";
  const period = textEntry ? periodLabel(textEntry.from, textEntry.to) : "a different period";
  return `${lead}; the text below describes ${period}.`;
}

export default function RuleRow({ rule, evaluation, highlight, placeIds, asOf }: RuleRowProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const ref = useRef<HTMLLIElement>(null);
  const [seenHighlight, setSeenHighlight] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const highlighted = highlight !== null;
  const isOpen = open;

  if (highlight !== seenHighlight) {
    setSeenHighlight(highlight);
    if (highlight !== null) setOpen(true);
  }

  useEffect(() => {
    if (highlight !== null) ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [highlight, reduce]);

  const href = safeUrl(rule.source_url);
  const dated = valueAt(rule, asOf);

  return (
    <li ref={ref} className="relative">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-3 inset-y-0 rounded-[var(--radius-control)] bg-accent-wash"
        initial={false}
        animate={{ opacity: highlighted ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setOpen(!isOpen)}
        className="relative flex w-full items-start gap-3 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-ui font-bold text-ink">{rule.title}</div>
          {dated.value && <div className="tnum mt-0.5 text-caption text-ink">{dated.value}</div>}
          {dated.scheduled && !dated.value && <div className="mt-0.5 text-caption text-ink-muted">Rate not stated for {formatDate(asOf)}</div>}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.75rem] text-ink-muted">
            <span className="break-words">{rule.citation}</span>
            {evaluation.conflict_flag && (
              <span className="inline-flex items-center gap-1 text-accent-ink">
                <FlagIcon size={12} weight="fill" aria-hidden /> Conflict
              </span>
            )}
          </div>
        </div>
        <StatusPill result={evaluation.result} />
        <CaretDownIcon
          size={16}
          aria-hidden
          className={`mt-1 shrink-0 text-ink-muted transition-transform duration-200 ease-[var(--ease-out)] ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
            className="relative overflow-hidden"
          >
            <div className="flex flex-col gap-3 pb-4">
              {dated.textDiffers && <p className="text-caption text-ink-muted">{periodNote(dated.entry, dated.textEntry)}</p>}
              <p className="text-ui text-ink">{rule.requirement}</p>

              {dated.textDiffers && dated.entry ? (
                <Quote label={`Source text for the selected date: ${entryLabel(dated.entry, rule.source_doc_id)}`} text={dated.entry.quoted_span} />
              ) : (
                <Quote label="Source text, quoted exactly" text={rule.quoted_span} />
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.75rem] text-ink-muted">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-ink">
                    Source: {sourceLabel(href)} <ArrowSquareOutIcon size={12} aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span>{rule.source_doc_id}</span>
                )}
                {rule.retrieved_at && <span className="tnum">Retrieved {rule.retrieved_at.slice(0, 10)}</span>}
                {rule.effective_date && <span className="tnum">Effective {formatDate(rule.effective_date)}</span>}
                {rule.source_in_supplied_corpus === false && <span className="font-sans text-caption">Source captured from a link-only page (not in the supplied corpus)</span>}
              </div>

              {dated.textDiffers && dated.entry ? (
                <Quote label={dated.textEntry ? `Source text for ${periodLabel(dated.textEntry.from, dated.textEntry.to)}` : "Source text for another period"} text={rule.quoted_span} />
              ) : (
                dated.entry && <Quote label={entryLabel(dated.entry, rule.source_doc_id)} text={dated.entry.quoted_span} />
              )}

              <ChecksTable evaluation={evaluation} />

              {evaluation.conflict_flag && (
                <div className="flex gap-2 rounded-[var(--radius-chip)] bg-accent-wash px-3 py-2 text-caption text-ink">
                  <FlagIcon size={14} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <strong className="font-bold">Flagged for human review.</strong> This rule may conflict with {conflictTargets(rule, placeIds) || "another rule"} at this
                    address. Groundtruth shows both instead of picking one.
                  </span>
                </div>
              )}

              {rule.conflict_note && (
                <div className="flex gap-2 px-1 text-caption text-ink-muted">
                  <ScalesIcon size={14} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-bold text-ink">Sources disagree.</span> {rule.conflict_note}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
