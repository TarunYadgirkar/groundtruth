"use client";

import { motion } from "motion/react";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/labels";
import type { Evaluation } from "@/lib/types";
import { STATUS_STYLE } from "./StatusPill";

export default function SummaryBar({ evaluations }: { evaluations: Evaluation[] }) {
  const counts = STATUS_ORDER.map((s) => ({ status: s, n: evaluations.filter((e) => e.result === s).length }));
  const total = evaluations.length || 1;
  const conflicts = evaluations.filter((e) => e.conflict_flag).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-hairline" aria-hidden>
        {counts
          .map(({ status }, i) => ({ status, upto: counts.slice(0, i + 1).reduce((sum, c) => sum + c.n, 0) }))
          .reverse()
          .map(({ status, upto }) => (
            <motion.div
              key={status}
              className="absolute inset-0 origin-left"
              initial={false}
              animate={{ scaleX: evaluations.length ? upto / total : 0 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              style={{ backgroundColor: STATUS_STYLE[status].fg }}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted" aria-label={`${total} results by status`}>
        {counts
          .filter((c) => c.n > 0)
          .map(({ status, n }) => (
            <li key={status} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: STATUS_STYLE[status].fg }} />
              <span className="tnum font-bold text-ink">{n}</span> {STATUS_LABEL[status].toLowerCase()}
            </li>
          ))}
        {conflicts > 0 && (
          <li className="flex items-center gap-1.5 text-accent-ink">
            <span aria-hidden className="size-2 rotate-45 bg-accent" />
            <span className="tnum font-bold">{conflicts}</span> flagged for review
          </li>
        )}
      </ul>
    </div>
  );
}
