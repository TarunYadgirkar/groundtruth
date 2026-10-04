"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowClockwiseIcon, CheckIcon, InfoIcon, MagnifyingGlassIcon, WarningIcon } from "@phosphor-icons/react";
import { CATEGORIES } from "@/lib/labels";
import { evaluateLive, type ResearchRequest, type ResearchStage } from "@/lib/live-research";
import type { Address } from "@/lib/types";
import { useLiveResearch, type ResearchState } from "@/lib/use-live-research";
import LiveRuleCard from "./LiveRuleCard";

type Target = { address: Address } | { city: string; state: string; county: string | null };

interface LiveResearchProps {
  target: Target;
  asOf: string;
}

const STAGE_ORDER: (ResearchStage | "applying")[] = ["searching", "reading", "verifying", "applying"];
const TICK_MS = 1000;

function requestFor(target: Target): ResearchRequest {
  if ("address" in target) {
    const a = target.address;
    return { city: a.legal_city ?? a.postal_city, state: a.state, county: a.county };
  }
  return { city: target.city, state: target.state as ResearchRequest["state"], county: target.county };
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, []);
  return <span className="tnum font-mono text-[0.75rem] text-ink-muted">{Math.max(0, Math.round((now - since) / 1000))} s</span>;
}

function Progress({ state }: { state: Extract<ResearchState, { phase: "running" }> }) {
  const current = STAGE_ORDER.indexOf(state.stage);
  const labels = ["Searching official sources", state.pages ? `Reading ${state.pages} page${state.pages === 1 ? "" : "s"}` : "Reading pages", "Verifying quotes", "Applying to this building"];
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-caption text-ink-muted">Usually under a minute and a half.</p>
        <Elapsed since={state.startedAt} />
      </div>
      <ol className="flex flex-col gap-1.5">
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={i} className={`flex items-center gap-2.5 text-ui transition-colors duration-150 ${done || active ? "text-ink" : "text-ink-faint"}`}>
              <span className="relative grid size-4 place-items-center">
                {done ? (
                  <span className="grid size-4 place-items-center rounded-full bg-contour text-paper">
                    <CheckIcon size={10} weight="bold" aria-hidden />
                  </span>
                ) : (
                  <motion.span
                    aria-hidden
                    className={`size-2.5 rounded-full ${active ? "bg-live" : "shadow-[inset_0_0_0_1px_var(--hairline-strong)]"}`}
                    animate={active ? { scale: [1, 0.7, 1] } : { scale: 1 }}
                    transition={active ? { repeat: Infinity, duration: 0.9 } : { duration: 0.15 }}
                  />
                )}
              </span>
              <span>{label}</span>
              <span className="sr-only">{done ? "done" : active ? "in progress" : "waiting"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Results({ state, target, asOf, onRetry }: { state: Extract<ResearchState, { phase: "done" }>; target: Target; asOf: string; onRetry: () => void }) {
  const { result } = state;
  const evaluations = useMemo(() => evaluateLive(result.rules, target, asOf), [result.rules, target, asOf]);
  const byId = useMemo(() => new Map(evaluations.map((e) => [e.team_rule_id, e])), [evaluations]);
  const order = (c: string) => CATEGORIES.findIndex((x) => x.id === c);
  const rules = [...result.rules].sort((a, b) => order(a.category) - order(b.category));

  if (!rules.length) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex gap-2 text-ui text-ink">
          <WarningIcon size={16} aria-hidden className="mt-0.5 shrink-0 text-live" />
          <span>
            Couldn&apos;t verify any rules from official sources — try again or check {result.city} housing department.
          </span>
        </p>
        <RetryButton onClick={onRetry} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="tnum font-mono text-[0.75rem] text-ink-muted">
        {rules.length} rule{rules.length === 1 ? "" : "s"} verified against {result.pages_read} fetched page{result.pages_read === 1 ? "" : "s"}
        {result.dropped > 0 && ` · ${result.dropped} dropped (quote not found)`}
        {result.cached ? " · saved result" : ` · ${state.seconds} s`}
      </p>
      <ul className="flex flex-col gap-3">
        {rules.map((r) => (
          <LiveRuleCard key={r.id} rule={r} evaluation={byId.get(r.id)} />
        ))}
      </ul>
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[var(--radius-control)] bg-surface px-3 text-caption font-bold text-ink shadow-[0_0_0_1px_var(--hairline-strong)] transition-[background-color,scale] duration-150 hover:bg-surface-sunk active:scale-[0.96]"
    >
      <ArrowClockwiseIcon size={14} weight="bold" aria-hidden /> Try again
    </button>
  );
}

export default function LiveResearch({ target, asOf }: LiveResearchProps) {
  const request = useMemo(() => requestFor(target), [target]);
  const { state, start } = useLiveResearch(request);

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={start}
          className="inline-flex h-9 w-fit items-center gap-2 rounded-[var(--radius-control)] bg-live-wash px-3 text-ui font-bold text-live-ink shadow-[inset_0_0_0_1px_rgba(111,71,8,0.18)] transition-[background-color,scale] duration-150 hover:bg-[#f2e2c2] active:scale-[0.96]"
        >
          <MagnifyingGlassIcon size={16} weight="bold" aria-hidden />
          Research {request.city} law live (beta)
        </button>
        <p className="text-caption text-ink-muted">Claude searches official code sites, and we keep only rules whose quotes appear word for word on a fetched page.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="live-research-title" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-live-wash/60 p-4 shadow-[inset_0_0_0_1px_rgba(111,71,8,0.14)]">
      <div className="flex flex-col gap-0.5">
        <h3 id="live-research-title" className="text-ui font-bold text-live-ink">
          Live research — not part of the verified corpus
        </h3>
        <p className="text-caption text-ink-muted">
          {request.city}, {request.state}. Found by Claude on the open web just now.{"address" in target && " Not counted in the totals above."}
        </p>
      </div>

      {state.phase === "running" && <Progress state={state} />}
      {state.phase === "done" && <Results state={state} target={target} asOf={asOf} onRetry={start} />}
      {state.phase === "error" && (
        <div className="flex flex-col gap-2">
          <p className="flex gap-2 text-ui text-ink">
            <WarningIcon size={16} aria-hidden className="mt-0.5 shrink-0 text-live" />
            <span>
              {state.message} Couldn&apos;t verify any rules from official sources — try again or check {request.city} housing department.
            </span>
          </p>
          <RetryButton onClick={start} />
        </div>
      )}

      {state.phase !== "running" && (
        <p className="flex gap-2 text-caption text-ink-muted">
          <InfoIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-bold text-ink">Not legal advice.</strong> Live results are unreviewed. A matching quote shows the text exists on that page, not that it is
            current or complete. Confirm with the city or a lawyer.
          </span>
        </p>
      )}
    </section>
  );
}
