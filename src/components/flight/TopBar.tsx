"use client";

import { motion } from "motion/react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { Address } from "@/lib/types";

interface TopBarProps {
  address: Address;
  onSearch: () => void;
  dark: boolean;
}

export default function TopBar({ address, onSearch, dark }: TopBarProps) {
  return (
    <motion.div
      className="absolute left-4 top-4 z-40 flex items-center gap-3 sm:left-6 sm:top-5"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0, delay: 0.15 }}
    >
      <button
        type="button"
        onClick={onSearch}
        aria-label={`New search. Current address: ${address.street_address}`}
        className={`group flex h-10 max-w-[min(78vw,420px)] items-center gap-2.5 rounded-[var(--radius-control)] pl-3 pr-4 text-ui transition-[background-color,box-shadow,color,scale] duration-300 ease-[var(--ease-out)] active:scale-[0.96] ${
          dark
            ? "bg-night/40 text-paper shadow-[0_0_0_1px_rgba(242,239,230,0.18)] backdrop-blur-md"
            : "bg-surface text-ink shadow-[0_0_0_1.5px_var(--ink),3px_3px_0_0_var(--ink)]"
        }`}
      >
        <span className="font-wide text-[0.8125rem] tracking-[-0.01em]">Groundtruth</span>
        <span aria-hidden className={`h-4 w-px ${dark ? "bg-paper/25" : "bg-hairline-strong"}`} />
        <MagnifyingGlassIcon size={16} aria-hidden className="shrink-0 opacity-70" />
        <span className="truncate">{address.street_address}</span>
      </button>
    </motion.div>
  );
}
