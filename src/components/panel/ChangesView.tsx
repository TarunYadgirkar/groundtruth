"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { STATUS_LABEL, formatDate } from "@/lib/labels";
import { changesBetween, type ChangeEvent } from "@/lib/timeline";
import type { Address, LookupResult } from "@/lib/types";
import { STATUS_STYLE } from "./StatusPill";

const DEFAULT_FROM = "2025-01-01";

interface ChangesViewProps {
  address: Address;
  asOf: string;
  onJump: (iso: string) => void;
  onShowRule: (id: string) => void;
}

function Result({ r }: { r: LookupResult | null }) {
  if (!r) return <span className="text-ink-muted">not listed</span>;
  return (
    <span className="whitespace-nowrap rounded-full px-1.5 font-bold" style={{ backgroundColor: STATUS_STYLE[r].bg, color: STATUS_STYLE[r].fg }}>
      {STATUS_LABEL[r]}
    </span>
  );
}

function group(events: ChangeEvent[]): [string, ChangeEvent[]][] {
  const m = new Map<string, ChangeEvent[]>();
  for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  return [...m.entries()];
}

export default function ChangesView({ address, asOf, onJump, onShowRule }: ChangesViewProps) {
  const [from, setFrom] = useState(DEFAULT_FROM);
  const events = useMemo(() => changesBetween(address, from, asOf), [address, from, asOf]);
  const groups = group(events);
  const [start, end] = from <= asOf ? [from, asOf] : [asOf, from];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        <label htmlFor="changes-from">From</label>
        <input
          id="changes-from"
          type="date"
          min="2024-01-01"
          max="2028-01-01"
          value={from}
          onChange={(e) => e.target.value && setFrom(e.target.value)}
          className="tnum h-7 rounded-[var(--radius-chip)] bg-surface-sunk px-1.5 font-mono text-[0.75rem] text-ink shadow-[inset_0_0_0_1px_var(--hairline)]"
        />
        <span>to the slider date,</span>
        <span className="tnum font-mono text-[0.75rem] text-ink">{asOf}</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-caption text-ink-muted">
          No rule changed status for this address between {formatDate(start)} and {formatDate(end)}.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-5 pl-5" aria-label="Changes by date">
          <span aria-hidden className="absolute bottom-1 left-[5px] top-1 w-px bg-hairline-strong" />
          {groups.map(([date, list], gi) => (
            <motion.li
              key={date}
              className="relative flex flex-col gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0, delay: gi * 0.05 }}
            >
              <span aria-hidden className="absolute -left-5 top-1 size-[11px] rounded-full bg-surface shadow-[inset_0_0_0_2px_var(--accent)]" />
              <button type="button" onClick={() => onJump(date)} className="link eyebrow tnum w-fit text-left text-ink" aria-label={`Move the slider to ${formatDate(date)}`}>
                {formatDate(date)}
              </button>
              <ul className="flex flex-col gap-2">
                {list.map((e) => (
                  <li key={e.rule.team_rule_id} className="flex flex-col gap-1">
                    <button type="button" onClick={() => onShowRule(e.rule.team_rule_id)} className="link w-fit text-left text-ui text-ink">
                      {e.rule.title}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem]">
                      <span className="font-mono text-ink-muted">{e.rule.citation}</span>
                      <span className="flex items-center gap-1.5">
                        <Result r={e.before} />
                        <ArrowRightIcon size={12} aria-label="becomes" className="text-ink-muted" />
                        <Result r={e.after} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}
