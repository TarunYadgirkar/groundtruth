"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MagnifyingGlassIcon, MapPinSimpleIcon } from "@phosphor-icons/react";
import { ADDRESSES } from "@/lib/data";
import { buildIndex, searchAddresses } from "@/lib/search";
import type { Address } from "@/lib/types";

const INDEX = buildIndex(ADDRESSES);
const FREE_TEXT_MIN = 6;

type Option = { kind: "sample"; address: Address } | { kind: "free"; query: string };

interface SearchBarProps {
  onSelect: (address: Address) => void;
  onLookupFree: (query: string) => void;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
}

function facts(a: Address): string {
  const built = a.year_built ? `Built ${a.year_built}` : "Year unknown";
  const units = a.units ? `${a.units} units` : "units unknown";
  return `${built} · ${units}`;
}

export default function SearchBar({ onSelect, onLookupFree, value, onChange, inputRef, autoFocus }: SearchBarProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<number | null>(null);

  const options = useMemo<Option[]>(() => {
    const matches = searchAddresses(INDEX, value).map((address) => ({ kind: "sample" as const, address }));
    const free: Option[] = value.trim().length >= FREE_TEXT_MIN ? [{ kind: "free", query: value.trim() }] : [];
    return [...matches, ...free];
  }, [value]);

  const showList = open && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);

  const choose = (opt: Option | undefined) => {
    if (!opt) return;
    setOpen(false);
    if (opt.kind === "sample") onSelect(opt.address);
    else onLookupFree(opt.query);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (Math.min(i, options.length - 1) + 1) % options.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (options.length ? (Math.min(i, options.length - 1) - 1 + options.length) % options.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!showList) setOpen(true);
      else choose(options[activeIndex]);
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else onChange("");
    }
  };

  return (
    <div className="relative w-full">
      <div className="group relative flex h-16 items-center gap-3 rounded-[var(--radius-control)] bg-surface px-5 shadow-[0_0_0_1.5px_var(--ink),var(--shadow-hard)] transition-[box-shadow] duration-200 ease-[var(--ease-out)] focus-within:shadow-[0_0_0_1.5px_var(--ink),var(--shadow-hard),0_0_0_8px_rgba(200,69,44,0.12)]">
        <MagnifyingGlassIcon size={22} weight="regular" className="shrink-0 text-ink-muted" aria-hidden />
        <label htmlFor={`${listId}-input`} className="sr-only">
          Apartment address
        </label>
        <input
          id={`${listId}-input`}
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder="Enter an apartment address"
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[1.125rem] text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
        <kbd className="hidden shrink-0 items-center gap-1.5 rounded-[var(--radius-chip)] bg-surface-sunk px-2 py-1 font-mono text-[0.75rem] text-ink-muted shadow-[inset_0_0_0_1px_var(--hairline)] sm:flex">
          <span aria-hidden>↵</span> Look up
        </kbd>
      </div>

      <AnimatePresence>
        {showList && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label="Matching addresses"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="absolute inset-x-0 top-[calc(100%+12px)] z-20 overflow-hidden rounded-[var(--radius-control)] bg-surface py-1.5 shadow-[0_0_0_1px_var(--hairline-strong),var(--shadow-float)]"
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((opt, i) => {
              const isActive = i === activeIndex;
              const key = opt.kind === "sample" ? opt.address.address_id : "free";
              return (
                <motion.li
                  key={key}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0, delay: i * 0.025 }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt)}
                  className={`relative mx-1.5 flex cursor-pointer items-center gap-3 rounded-[4px] px-3 py-2.5 transition-colors duration-100 ${
                    isActive ? "bg-accent-wash" : ""
                  }`}
                >
                  {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent" />}
                  {opt.kind === "sample" ? (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body text-ink">{opt.address.street_address}</div>
                        <div className="truncate text-caption text-ink-muted">
                          {opt.address.legal_city}, {opt.address.state} {opt.address.zip}
                          {opt.address.legal_city !== opt.address.postal_city && (
                            <span className="text-ink-faint"> · mailed as {opt.address.postal_city}</span>
                          )}
                        </div>
                        <div className="tnum truncate font-mono text-[0.75rem] text-ink-muted sm:hidden">{facts(opt.address)}</div>
                      </div>
                      <span className="tnum hidden shrink-0 font-mono text-[0.75rem] text-ink-muted sm:inline">{facts(opt.address)}</span>
                    </>
                  ) : (
                    <>
                      <MapPinSimpleIcon size={18} className="shrink-0 text-accent" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body text-ink">Look up any address: “{opt.query}”</div>
                        <div className="text-caption text-ink-muted">Not in the sample. Shows city and state rules; building facts stay unknown.</div>
                      </div>
                    </>
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
