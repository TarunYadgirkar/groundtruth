"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { InfoIcon } from "@phosphor-icons/react";
import { SOURCES_RETRIEVED, ruleById, rulesForPlace } from "@/lib/data";
import { CATEGORIES, STATUS_ORDER, formatDate } from "@/lib/labels";
import type { Address, Evaluation, Rule } from "@/lib/types";
import type { UiAction } from "@/lib/ask-schema";
import ChangesView from "./ChangesView";
import Checklist from "./Checklist";
import PanelHeader from "./PanelHeader";
import RuleRow from "./RuleRow";
import SummaryBar from "./SummaryBar";
import TimeSlider from "./TimeSlider";
import AskBar from "./AskBar";

interface AnswerPanelProps {
  address: Address;
  lat: number;
  lng: number;
  asOf: string;
  onAsOfChange: (iso: string) => void;
  evaluations: Evaluation[];
  ruleCount: number;
  isDesktop: boolean;
}

interface Row {
  rule: Rule;
  evaluation: Evaluation;
}

const HIGHLIGHT_MS = 4500;
const VIEWS = [
  { id: "rules", label: "Rules" },
  { id: "changes", label: "What changed" },
] as const;

function sortRows(rows: Row[]): Row[] {
  return [...rows].sort(
    (a, b) => STATUS_ORDER.indexOf(a.evaluation.result) - STATUS_ORDER.indexOf(b.evaluation.result) || a.rule.title.localeCompare(b.rule.title),
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h3 className="flex items-baseline justify-between gap-3 text-ui font-bold text-ink">
      {children}
      {count !== undefined && <span className="tnum font-mono text-[0.75rem] font-normal text-ink-muted">{count}</span>}
    </h3>
  );
}

export default function AnswerPanel({ address, lat, lng, asOf, onAsOfChange, evaluations, ruleCount, isDesktop }: AnswerPanelProps) {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"rules" | "changes">("rules");
  const [highlight, setHighlight] = useState<{ id: string; nonce: number } | null>(null);
  const city = address.legal_city ?? address.postal_city;
  const placeRules = useMemo(() => rulesForPlace(address), [address]);

  const rows = useMemo<Row[]>(
    () =>
      evaluations
        .map((evaluation) => ({ evaluation, rule: ruleById(evaluation.team_rule_id) }))
        .filter((r): r is Row => r.rule !== undefined),
    [evaluations],
  );
  const placeIds = useMemo(() => new Set(evaluations.map((e) => e.team_rule_id)), [evaluations]);
  const enacted = rows.filter((r) => r.evaluation.result !== "pending");
  const pending = rows.filter((r) => r.evaluation.result === "pending");

  const steps = useMemo(
    () => [
      address.geocode_match === "google" ? "Address geocoded (live lookup)" : "Address geocoded",
      address.legal_city ? `Jurisdiction resolved · ${city}, ${address.state}` : `Legal city not confirmed · ${address.state} rules apply`,
      `${ruleCount} rules in scope`,
      "Testing coverage against building facts",
      "Checking pending law",
    ],
    [address, city, ruleCount],
  );

  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const onActions = useCallback(
    (actions: UiAction[]) => {
      for (const a of actions) {
        if (a.type === "SET_AS_OF") onAsOfChange(a.date);
      }
      const h = actions.find((a) => a.type === "HIGHLIGHT_RULE");
      if (h && h.type === "HIGHLIGHT_RULE") {
        setView("rules");
        setHighlight({ id: h.rule_id, nonce: Date.now() });
      }
    },
    [onAsOfChange],
  );

  const onDone = useCallback(() => setReady(true), []);
  const showRule = useCallback((id: string) => {
    setView("rules");
    setHighlight({ id, nonce: Date.now() });
  }, []);

  const motionProps = isDesktop
    ? { initial: { x: 32, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 32, opacity: 0 } }
    : { initial: { y: 48, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 48, opacity: 0 } };

  return (
    <motion.aside
      aria-label={`Housing laws at ${address.street_address}`}
      {...motionProps}
      transition={{ type: "spring", duration: 0.6, bounce: 0 }}
      className={
        isDesktop
          ? "absolute inset-y-0 right-0 z-30 flex w-[var(--panel-w)] flex-col bg-surface shadow-[-1px_0_0_0_var(--hairline-strong),-24px_0_48px_-24px_rgba(18,26,23,0.35)]"
          : "absolute inset-x-0 bottom-0 z-30 flex h-[68dvh] flex-col rounded-t-[var(--radius-panel)] bg-surface shadow-[0_-1px_0_0_var(--hairline-strong),0_-24px_48px_-24px_rgba(18,26,23,0.35)]"
      }
    >
      {!isDesktop && <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-hairline-strong" />}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className={`flex flex-col gap-6 px-5 pb-6 sm:px-6 ${isDesktop ? "pt-6" : "pt-3"}`}>
          <PanelHeader address={address} lat={lat} lng={lng} asOf={asOf} />

          <AnimatePresence mode="wait" initial={false}>
            {!ready ? (
              <Checklist key="check" steps={steps} onDone={onDone} />
            ) : (
              <motion.div key="results" className="flex flex-col gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <div className="flex flex-col gap-2">
                  <p className="eyebrow tnum text-ink-muted">
                    {enacted.length} enacted · {pending.length} pending · as of {formatDate(asOf)}
                  </p>
                  <SummaryBar evaluations={evaluations} />
                </div>

                <div role="group" aria-label="Panel view" className="flex w-fit gap-0.5 rounded-[var(--radius-control)] bg-surface-sunk p-0.5 shadow-[inset_0_0_0_1px_var(--hairline)]">
                  {VIEWS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={view === v.id}
                      onClick={() => setView(v.id)}
                      className={`relative h-7 rounded-[4px] px-3 text-caption transition-colors duration-150 ${view === v.id ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                    >
                      {view === v.id && (
                        <motion.span layoutId="view-pill" className="absolute inset-0 rounded-[4px] bg-surface shadow-[0_0_0_1px_var(--hairline-strong)]" transition={{ type: "spring", duration: 0.3, bounce: 0 }} />
                      )}
                      <span className="relative">{v.label}</span>
                    </button>
                  ))}
                </div>

                {view === "rules" ? (
                  <>
                {CATEGORIES.map((cat, gi) => {
                  const list = sortRows(enacted.filter((r) => r.rule.category === cat.id));
                  return (
                    <motion.section
                      key={cat.id}
                      aria-labelledby={`cat-${cat.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", duration: 0.45, bounce: 0, delay: gi * 0.06 }}
                      className="flex flex-col"
                    >
                      <div id={`cat-${cat.id}`} className="pb-1">
                        <SectionTitle count={list.length || undefined}>{cat.label}</SectionTitle>
                      </div>
                      {list.length === 0 ? (
                        <p className="py-2 text-caption text-ink-faint">No rule found at any level for this address.</p>
                      ) : (
                        <ul className="flex flex-col divide-y divide-hairline">
                          {list.map((r) => (
                            <RuleRow key={r.rule.team_rule_id} rule={r.rule} evaluation={r.evaluation} highlight={highlight?.id === r.rule.team_rule_id ? highlight.nonce : null} placeIds={placeIds} />
                          ))}
                        </ul>
                      )}
                    </motion.section>
                  );
                })}

                {pending.length > 0 && (
                  <motion.section
                    aria-labelledby="cat-pending"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", duration: 0.45, bounce: 0, delay: CATEGORIES.length * 0.06 }}
                    className="flex flex-col rounded-[var(--radius-control)] bg-surface-sunk px-4 py-3"
                  >
                    <div id="cat-pending">
                      <SectionTitle count={pending.length}>Proposed, not law</SectionTitle>
                      <p className="mt-0.5 text-caption text-ink-muted">Bills and proposals. Shown so you can see what may change. None of these are in force.</p>
                    </div>
                    <ul className="mt-1 flex flex-col divide-y divide-hairline">
                      {sortRows(pending).map((r) => (
                        <RuleRow key={r.rule.team_rule_id} rule={r.rule} evaluation={r.evaluation} highlight={highlight?.id === r.rule.team_rule_id ? highlight.nonce : null} placeIds={placeIds} />
                      ))}
                    </ul>
                  </motion.section>
                )}

                  </>
                ) : (
                  <ChangesView address={address} asOf={asOf} onJump={onAsOfChange} onShowRule={showRule} />
                )}

                <p className="flex gap-2 text-caption text-ink-muted">
                  <InfoIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
                  <span>
                    <strong className="font-bold text-ink">Not legal advice.</strong> Results come from public law text as retrieved {SOURCES_RETRIEVED} and public building
                    records. “Unknown” means the records lack a fact the rule depends on. Check with a lawyer or the local housing agency before acting.
                  </span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!isDesktop && <AskBar address={address} asOf={asOf} onActions={onActions} />}
        </div>
      </div>

      <div className="shrink-0 bg-surface px-5 pb-4 pt-3 shadow-[0_-1px_0_0_var(--hairline)] sm:px-6">
        <div className="flex flex-col gap-3">
          <TimeSlider asOf={asOf} onChange={onAsOfChange} rules={placeRules} />
          {isDesktop && <AskBar address={address} asOf={asOf} onActions={onActions} />}
        </div>
      </div>
    </motion.aside>
  );
}
