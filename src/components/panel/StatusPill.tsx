"use client";

import { AnimatePresence, motion } from "motion/react";
import { STATUS_LABEL } from "@/lib/labels";
import type { LookupResult } from "@/lib/types";

export const STATUS_STYLE: Record<LookupResult, { bg: string; fg: string }> = {
  applies: { bg: "var(--st-applies-bg)", fg: "var(--st-applies-fg)" },
  unknown: { bg: "var(--st-unknown-bg)", fg: "var(--st-unknown-fg)" },
  superseded: { bg: "var(--st-superseded-bg)", fg: "var(--st-superseded-fg)" },
  not_yet_effective: { bg: "var(--st-nye-bg)", fg: "var(--st-nye-fg)" },
  pending: { bg: "var(--st-pending-bg)", fg: "var(--st-pending-fg)" },
};

export function StatusDot({ result }: { result: LookupResult }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: STATUS_STYLE[result].fg }} />;
}

export default function StatusPill({ result }: { result: LookupResult }) {
  const s = STATUS_STYLE[result];
  return (
    <motion.span
      layout
      transition={{ type: "spring", duration: 0.35, bounce: 0 }}
      className="relative inline-flex h-6 shrink-0 items-center overflow-hidden whitespace-nowrap rounded-full px-2.5 text-[0.75rem] font-bold transition-[background-color,color] duration-300"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={result}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.35, bounce: 0 }}
        >
          {STATUS_LABEL[result]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
