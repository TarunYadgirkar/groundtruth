"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckIcon } from "@phosphor-icons/react";

const STEP_MS = 260;

interface ChecklistProps {
  steps: string[];
  onDone: () => void;
}

export default function Checklist({ steps, onDone }: ChecklistProps) {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= steps.length) {
      const t = window.setTimeout(onDone, reduce ? 0 : 320);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setDone((d) => d + 1), reduce ? 0 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [done, steps.length, onDone, reduce]);

  return (
    <motion.ol
      aria-label="Lookup progress"
      className="flex flex-col gap-1.5 py-2"
      exit={{ opacity: 0, y: -4, transition: { duration: 0.18 } }}
    >
      {steps.map((s, i) => {
        const isDone = i < done;
        const isActive = i === done;
        return (
          <li key={s} className={`flex items-center gap-2.5 text-ui transition-colors duration-150 ${isDone ? "text-ink" : "text-ink-faint"}`}>
            <span className="relative grid size-4 place-items-center">
              <motion.span
                className="absolute inset-0 grid place-items-center rounded-full bg-contour text-paper"
                initial={false}
                animate={{ scale: isDone ? 1 : 0.25, opacity: isDone ? 1 : 0, filter: isDone ? "blur(0px)" : "blur(4px)" }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              >
                <CheckIcon size={10} weight="bold" aria-hidden />
              </motion.span>
              <motion.span
                aria-hidden
                className={`absolute inset-[3px] rounded-full ${isActive ? "bg-accent" : "bg-transparent shadow-[inset_0_0_0_1px_var(--hairline-strong)]"}`}
                animate={{ opacity: isDone ? 0 : 1, scale: isActive ? [1, 0.7, 1] : 1 }}
                transition={isActive ? { scale: { repeat: Infinity, duration: 0.9 } } : { duration: 0.15 }}
              />
            </span>
            <span>{s}</span>
            <span className="sr-only">{isDone ? "done" : "in progress"}</span>
          </li>
        );
      })}
    </motion.ol>
  );
}
