"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowSquareOutIcon, CaretDownIcon, FlagIcon } from "@phosphor-icons/react";
import { ruleById } from "@/lib/data";
import { formatDate } from "@/lib/labels";
import type { Evaluation, Rule } from "@/lib/types";
import StatusPill from "./StatusPill";

interface RuleRowProps {
  rule: Rule;
  evaluation: Evaluation;
  highlighted: boolean;
}

function safeUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function conflictTargets(rule: Rule): string {
  return rule.conflicts_with
    .map((id) => ruleById(id)?.jurisdiction ?? id)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
}

export default function RuleRow({ rule, evaluation, highlighted }: RuleRowProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const ref = useRef<HTMLLIElement>(null);
  const isOpen = open || highlighted;

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const href = safeUrl(rule.source_url);

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
              <p className="text-ui text-ink">{rule.requirement}</p>

              <blockquote className="relative rounded-[var(--radius-chip)] bg-surface-sunk py-2.5 pl-4 pr-3 text-ui text-ink">
                <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-ink/70" />
                <span className="eyebrow mb-1 block text-ink-muted">Source text, quoted exactly</span>
                <p className="font-mono text-[0.8125rem] leading-[1.55]">“{rule.quoted_span}”</p>
              </blockquote>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.75rem] text-ink-muted">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-ink">
                    {rule.source_doc_id ?? "Source"} <ArrowSquareOutIcon size={12} aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span>{rule.source_doc_id}</span>
                )}
                {rule.retrieved_at && <span className="tnum">Retrieved {rule.retrieved_at.slice(0, 10)}</span>}
                {rule.effective_date && <span className="tnum">Effective {formatDate(rule.effective_date)}</span>}
              </div>

              <div className="rounded-[var(--radius-chip)] bg-paper px-3 py-2 text-caption text-ink">
                <span className="eyebrow mr-2 text-ink-muted">Why</span>
                {evaluation.explanation}
              </div>

              {evaluation.conflict_flag && (
                <div className="flex gap-2 rounded-[var(--radius-chip)] bg-accent-wash px-3 py-2 text-caption text-ink">
                  <FlagIcon size={14} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <strong className="font-bold">Flagged for human review.</strong>{" "}
                    {rule.conflict_note ?? `May conflict with ${conflictTargets(rule)}.`}
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
