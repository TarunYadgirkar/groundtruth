"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import type { Address } from "@/lib/types";

export interface UserFacts {
  year_built: number | null;
  units: number | null;
}

interface FactsFormProps {
  address: Address;
  recordYear: number | null;
  recordUnits: number | null;
  hasUserFacts: boolean;
  unknownCount: number;
  onChange: (facts: UserFacts | null) => void;
}

const MIN_YEAR = 1700;
const MAX_YEAR = new Date().getFullYear() + 2;
const MAX_UNITS = 5000;

function parseYear(v: string): number | null | "bad" {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR ? n : "bad";
}

function parseUnits(v: string): number | null | "bad" {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= MAX_UNITS ? n : "bad";
}

const input =
  "h-9 w-full rounded-[var(--radius-control)] bg-surface px-2.5 text-ui text-ink tnum shadow-[inset_0_0_0_1px_var(--hairline-strong)] outline-none placeholder:text-ink-faint focus-visible:shadow-[inset_0_0_0_1.5px_var(--ink),0_0_0_4px_rgba(200,69,44,0.12)]";

export default function FactsForm({ address, recordYear, recordUnits, hasUserFacts, unknownCount, onChange }: FactsFormProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(hasUserFacts && address.year_built ? String(address.year_built) : "");
  const [units, setUnits] = useState(hasUserFacts && address.units ? String(address.units) : "");
  const [error, setError] = useState<string | null>(null);
  const needsYear = recordYear == null;
  const needsUnits = recordUnits == null;
  if (!needsYear && !needsUnits) return null;
  if (unknownCount === 0 && !hasUserFacts) return null;

  const missing = [needsYear && "year built", needsUnits && "unit count"].filter(Boolean).join(" and ");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const y = needsYear ? parseYear(year) : null;
    const u = needsUnits ? parseUnits(units) : null;
    if (y === "bad") return setError(`Enter a year between ${MIN_YEAR} and ${MAX_YEAR}.`);
    if (u === "bad") return setError(`Enter a whole number of units from 1 to ${MAX_UNITS}.`);
    if (y == null && u == null) return setError("Add at least one fact.");
    setError(null);
    onChange({ year_built: y, units: u });
    setOpen(false);
  };

  const clear = () => {
    setYear("");
    setUnits("");
    setError(null);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-surface-sunk px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--hairline)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-ink">
          {hasUserFacts ? (
            <>Results use the facts you added. They aren&rsquo;t from public records.</>
          ) : (
            <>
              <strong className="font-bold">Know your building?</strong> Add the {missing} to resolve unknowns
              <span className="text-ink-muted"> ({unknownCount} {unknownCount === 1 ? "rule depends" : "rules depend"} on facts the records lack)</span>.
            </>
          )}
        </p>
        <div className="flex shrink-0 gap-1">
          {hasUserFacts && !open && (
            <button type="button" onClick={clear} className="h-7 rounded-[4px] px-2 text-caption text-ink-muted hover:bg-paper hover:text-ink">
              Clear
            </button>
          )}
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls={`${id}-form`}
              className="flex h-7 items-center gap-1.5 rounded-[4px] bg-surface px-2 text-caption text-ink shadow-[0_0_0_1px_var(--hairline-strong)] transition-[scale] duration-150 hover:bg-paper active:scale-[0.96]"
            >
              <PencilSimpleIcon size={12} aria-hidden /> {hasUserFacts ? "Edit" : "Add facts"}
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            id={`${id}-form`}
            onSubmit={submit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 pt-1">
              {needsYear && (
                <label className="flex flex-col gap-1">
                  <span className="eyebrow text-ink-muted">Year built</span>
                  <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1962" className={input} autoFocus />
                </label>
              )}
              {needsUnits && (
                <label className="flex flex-col gap-1">
                  <span className="eyebrow text-ink-muted">Units in building</span>
                  <input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. 12" className={input} autoFocus={!needsYear} />
                </label>
              )}
            </div>
            {error && (
              <p role="alert" className="text-caption text-accent-ink">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-[4px] px-3 text-caption text-ink-muted hover:bg-paper hover:text-ink">
                Cancel
              </button>
              <button type="submit" className="h-8 rounded-[4px] bg-ink px-3 text-caption text-paper transition-[scale] duration-150 active:scale-[0.96]">
                Update results
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
