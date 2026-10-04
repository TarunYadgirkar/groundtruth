"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { WarningIcon } from "@phosphor-icons/react";
import { ADDRESSES, SOURCES_RETRIEVED } from "@/lib/data";
import type { Address } from "@/lib/types";
import { COVERED_CITIES } from "@/lib/place";
import { STATE_NAME } from "@/lib/labels";
import type { LandingError } from "../Navigator";
import SearchBar from "./SearchBar";
import LiveResearch from "../research/LiveResearch";
import { DEFAULT_AS_OF } from "@/lib/labels";

const EXAMPLE_IDS = ["A0001", "A0065", "A0002"];
const EXAMPLE_MS = 3200;
const EASE = [0.2, 0, 0, 1] as const;

const SCOPE_EXAMPLE_IDS = ["A0001", "A0008", "A0010"];
const SCOPE_EXAMPLES = SCOPE_EXAMPLE_IDS.map((id) => ADDRESSES.find((a) => a.address_id === id)).filter((a): a is Address => !!a);
const CITY_LIST = (["CA", "NJ", "MA"] as const)
  .map((st) => `${STATE_NAME[st]}: ${COVERED_CITIES.filter((c) => c.state === st).map((c) => c.city).join(", ")}`)
  .join(". ");

const EXAMPLES = EXAMPLE_IDS.map((id) => ADDRESSES.find((a) => a.address_id === id)).filter((a): a is Address => !!a);

interface LandingProps {
  onSelect: (a: Address) => void;
  onLookupFree: (q: string) => void;
  error: LandingError | null;
  autoFocus: boolean;
}

// `initial` must match the server render (where reduced motion is unknown), so only the transition varies.
const enter = (i: number, reduce: boolean | null) => ({
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay: 0.25 + i * 0.1 },
});

export default function Landing({ onSelect, onLookupFree, error, autoFocus }: LandingProps) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLES.length), EXAMPLE_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused]);

  const example = EXAMPLES[exampleIdx];

  return (
    <motion.div
      className="relative z-10 flex h-dvh flex-col overflow-y-auto px-4 sm:px-8"
      exit={{ opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.35, ease: EASE } }}
    >
      <header className="flex h-16 items-center justify-between">
        <motion.span {...enter(0, reduce)} className="eyebrow text-ink-muted">
          Rental housing law navigator
        </motion.span>
        <motion.div {...enter(0, reduce)}>
          <Link href="/method" className="link text-ui text-ink">
            How it works
          </Link>
        </motion.div>
      </header>

      <main className="flex flex-1 flex-col items-center pt-[14vh] sm:pt-[18vh]">
        <motion.h1 {...enter(1, reduce)} className="font-wide text-hero text-ink">
          Groundtruth
        </motion.h1>
        <motion.p {...enter(2, reduce)} className="mt-4 max-w-[34ch] text-center text-title text-ink-muted sm:max-w-none">
          Which housing laws apply at this address, on any date.
        </motion.p>

        <motion.div {...enter(3, reduce)} className="relative z-20 mt-10 w-full max-w-[680px]">
          <SearchBar value={query} onChange={setQuery} onSelect={onSelect} onLookupFree={onLookupFree} autoFocus={autoFocus} />
        </motion.div>

        <motion.div
          {...enter(4, reduce)}
          className="mt-5 flex h-6 items-center gap-2 text-ui text-ink-muted"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span>Try</span>
          <AnimatePresence mode="wait" initial={false}>
            {example && (
              <motion.button
                key={example.address_id}
                type="button"
                onClick={() => onSelect(example)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                className="link text-ink"
              >
                {example.street_address}, {example.postal_city}
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.p {...enter(4, reduce)} className="mt-1 text-caption text-ink-muted">
          Covers addresses in California, New Jersey and Massachusetts.
        </motion.p>

        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex max-w-[64ch] items-start gap-2 rounded-[var(--radius-chip)] bg-surface px-3 py-2 text-ui text-ink shadow-[0_0_0_1px_var(--hairline)]"
            >
              <WarningIcon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div className="flex flex-col gap-1.5">
                <p>{error.message}</p>
                {error.outOfScope && (
                  <p className="text-caption text-ink-muted">
                    Statewide rules for any address in those three states, plus city ordinances for {CITY_LIST}.
                  </p>
                )}
                {error.place && <LiveResearch key={`${error.place.city}-${error.place.state}`} target={error.place} asOf={DEFAULT_AS_OF} />}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
                  Try
                  {SCOPE_EXAMPLES.map((a) => (
                    <button key={a.address_id} type="button" onClick={() => onSelect(a)} className="link text-ink">
                      {a.street_address}, {a.legal_city}
                    </button>
                  ))}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <motion.footer
        {...enter(5, reduce)}
        className="flex flex-col items-center gap-1 pb-12 text-center font-mono text-[0.75rem] text-ink-muted sm:flex-row sm:justify-between"
      >
        <span className="tnum">500 sample buildings · CA · NJ · MA · as of Oct 1, 2026</span>
        <span>Not legal advice · Sources: public law as retrieved {SOURCES_RETRIEVED}</span>
      </motion.footer>
    </motion.div>
  );
}
