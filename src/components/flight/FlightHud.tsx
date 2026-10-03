"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Address } from "@/lib/types";

interface FlightHudProps {
  address: Address;
  lat: number;
  lng: number;
  ruleCount: number;
  progress: number;
  onPaper: boolean;
}

const STAGES = [0.04, 0.32, 0.6, 0.82];

function coord(v: number, pos: string, neg: string): string {
  return `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
}

function parcelLine(a: Address): string {
  const built = a.year_built ? `built ${a.year_built}` : "year built not in records";
  const units = a.units ? `${a.units} units` : "unit count not in records";
  return `${built} · ${units}`;
}

export default function FlightHud({ address, lat, lng, ruleCount, progress, onPaper }: FlightHudProps) {
  const city = address.legal_city ?? address.postal_city;
  const lines: { key: string; label: string; value: string; note?: string }[] = [
    { key: "loc", label: "Locating", value: `${coord(lat, "N", "S")}  ${coord(lng, "E", "W")}` },
    {
      key: "jur",
      label: "Jurisdiction found",
      value: `City of ${city}`,
      note: address.postal_city && address.postal_city !== city ? `mailed as ${address.postal_city} · legally ${city}` : undefined,
    },
    { key: "parcel", label: "Parcel identified", value: parcelLine(address) },
    { key: "rules", label: "Reading", value: `${ruleCount} rules in scope` },
  ];
  const visible = lines.filter((_, i) => progress >= STAGES[i]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute bottom-10 left-4 z-30 flex flex-col gap-2 sm:bottom-14 sm:left-10">
      <AnimatePresence initial={false}>
        {visible.map((l, i) => {
          const isCurrent = i === visible.length - 1;
          return (
            <motion.div
              key={l.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: isCurrent ? 1 : 0.55, x: 0 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
              className={`font-mono text-[0.75rem] leading-5 tracking-[0.06em] ${onPaper ? "text-ink" : "text-paper [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]"}`}
            >
              <span className="uppercase">
                <span className={isCurrent ? (onPaper ? "text-accent-ink" : "text-accent-on-dark") : ""}>{l.label}</span>
                <span className="opacity-60"> · </span>
                <span className="tnum">{l.value}</span>
              </span>
              {l.note && <div className="pl-0 opacity-80">{l.note}</div>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
