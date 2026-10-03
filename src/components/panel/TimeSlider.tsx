"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DEFAULT_AS_OF, SLIDER_MAX, SLIDER_MIN, TEST_DATES, dayToIso, formatDate, isoToDay } from "@/lib/labels";
import type { Rule } from "@/lib/types";

interface TimeSliderProps {
  asOf: string;
  onChange: (iso: string) => void;
  rules: Rule[];
}

interface Tick {
  date: string;
  titles: string[];
}

const MIN = isoToDay(SLIDER_MIN);
const MAX = isoToDay(SLIDER_MAX);

function pct(iso: string): number {
  return ((isoToDay(iso) - MIN) / (MAX - MIN)) * 100;
}

function buildTicks(rules: Rule[]): Tick[] {
  const map = new Map<string, string[]>();
  for (const r of rules) {
    const d = r.effective_date;
    if (!d || d < SLIDER_MIN || d > SLIDER_MAX) continue;
    map.set(d, [...(map.get(d) ?? []), r.title]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, titles]) => ({ date, titles }));
}

export default function TimeSlider({ asOf, onChange, rules }: TimeSliderProps) {
  const id = useId();
  const ticks = useMemo(() => buildTicks(rules), [rules]);
  const [hover, setHover] = useState<Tick | null>(null);
  const shown = hover;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="eyebrow text-ink-muted">
          As of
        </label>
        <output htmlFor={id} className="tnum font-mono text-ui font-bold text-ink">
          {formatDate(asOf)}
        </output>
      </div>

      <div className="relative">
        <input
          id={id}
          type="range"
          className="gt-range relative z-10"
          min={MIN}
          max={MAX}
          step={1}
          value={isoToDay(asOf)}
          aria-valuetext={formatDate(asOf)}
          onChange={(e) => onChange(dayToIso(Number(e.target.value)))}
        />
        <div className="pointer-events-none absolute inset-x-[8px] top-1/2 h-0">
          <div className="absolute left-0 top-[-1px] h-[2px] rounded-full bg-accent" style={{ width: `${pct(asOf)}%` }} />
          <div
            aria-hidden
            className="absolute top-[6px] h-[5px] w-px bg-ink-muted"
            style={{ left: `${pct(DEFAULT_AS_OF)}%` }}
            title="Default query date"
          />
        </div>
        <div className="absolute inset-x-[8px] top-0 h-0">
          {ticks.map((t) => (
            <button
              key={t.date}
              type="button"
              onClick={() => onChange(t.date)}
              onMouseEnter={() => setHover(t)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(t)}
              onBlur={() => setHover(null)}
              aria-label={`Jump to ${formatDate(t.date)}: ${t.titles.join("; ")} takes effect`}
              className="absolute top-[-6px] z-20 grid h-4 w-3 -translate-x-1/2 place-items-center"
              style={{ left: `${pct(t.date)}%` }}
            >
              <span aria-hidden className={`block h-2.5 w-[2px] rounded-full ${t.date <= asOf ? "bg-accent" : "bg-ink/50"}`} />
            </button>
          ))}
        </div>
        <AnimatePresence>
          {shown && (
            <motion.div
              role="tooltip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
              transition={{ type: "spring", duration: 0.25, bounce: 0 }}
              className="absolute bottom-[calc(100%+8px)] z-30 w-max max-w-[260px] -translate-x-1/2 rounded-[var(--radius-chip)] bg-ink px-2.5 py-1.5 text-caption text-paper shadow-[var(--shadow-float)]"
              style={{ left: `clamp(130px, ${pct(shown.date)}%, calc(100% - 130px))` }}
            >
              <span className="tnum block font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-paper/70">
                Takes effect {formatDate(shown.date)}
              </span>
              {shown.titles.slice(0, 3).map((t) => (
                <span key={t} className="block">
                  {t}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="tnum flex justify-between font-mono text-[0.6875rem] text-ink-faint">
        <span>2024</span>
        <span>2025</span>
        <span>2026</span>
        <span>2027</span>
        <span>2028</span>
      </div>

      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Test dates">
        {[DEFAULT_AS_OF, ...TEST_DATES].map((d) => {
          const active = d === asOf;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(d)}
              className={`tnum h-7 shrink-0 rounded-[var(--radius-chip)] px-2 font-mono text-[0.75rem] transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.96] ${
                active ? "bg-ink text-paper" : "bg-surface-sunk text-ink shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-paper"
              }`}
            >
              {d === DEFAULT_AS_OF ? `${d} · default` : d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
