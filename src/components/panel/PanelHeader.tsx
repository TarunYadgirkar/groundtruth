"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowSquareOutIcon, CheckIcon, DotsThreeIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import { STATE_NAME } from "@/lib/labels";
import type { Address } from "@/lib/types";
import BuildingFacts from "./BuildingFacts";

interface PanelHeaderProps {
  address: Address;
  lat: number;
  lng: number;
  asOf: string;
}

const COPIED_MS = 1800;

const iconButton =
  "grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-muted transition-[background-color,color,scale] duration-150 hover:bg-surface-sunk hover:text-ink active:scale-[0.96]";

function OverflowMenu({ lat, lng }: { lat: number; lng: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center justify-between gap-3 rounded-[4px] px-2.5 py-2 text-ui text-ink hover:bg-surface-sunk";

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className={iconButton}>
        <DotsThreeIcon size={20} weight="bold" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 origin-top-right rounded-[var(--radius-control)] bg-surface p-1 shadow-[0_0_0_1px_var(--hairline-strong),var(--shadow-float)]"
          >
            <a
              role="menuitem"
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={item}
            >
              Open in Google Maps <ArrowSquareOutIcon size={14} aria-hidden />
            </a>
            <Link role="menuitem" href="/changes" className={item}>
              Who each law change affects
            </Link>
            <Link role="menuitem" href="/method" className={item}>
              How results are computed
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShareButton({ address, asOf }: { address: Address; asOf: string }) {
  const [copied, setCopied] = useState(false);
  const isSample = !address.address_id.startsWith("live-");

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!isSample) return null;

  const copy = async () => {
    const url = new URL(window.location.origin);
    url.searchParams.set("a", address.address_id);
    url.searchParams.set("asOf", asOf);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url.toString());
    }
  };

  return (
    <button type="button" onClick={copy} aria-label={copied ? "Link copied" : "Copy link to this address and date"} className={`${iconButton} relative`}>
      <motion.span className="absolute" animate={{ opacity: copied ? 0 : 1, scale: copied ? 0.25 : 1, filter: copied ? "blur(4px)" : "blur(0px)" }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
        <LinkSimpleIcon size={18} aria-hidden />
      </motion.span>
      <motion.span className="absolute text-contour" initial={false} animate={{ opacity: copied ? 1 : 0, scale: copied ? 1 : 0.25, filter: copied ? "blur(0px)" : "blur(4px)" }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
        <CheckIcon size={18} weight="bold" aria-hidden />
      </motion.span>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}

export default function PanelHeader({ address, lat, lng, asOf }: PanelHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const city = address.legal_city ?? address.postal_city;
  const mailedDifferently = address.postal_city && address.postal_city !== city;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Jurisdiction" className="eyebrow flex min-w-0 items-center gap-1.5 text-ink-muted">
          <span>{STATE_NAME[address.state]}</span>
          <span aria-hidden className="text-accent">›</span>
          <span className="truncate text-ink">{city}</span>
        </nav>
        <div className="-mr-1.5 flex items-center gap-0.5">
          <ShareButton address={address} asOf={asOf} />
          <OverflowMenu lat={lat} lng={lng} />
        </div>
      </div>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="font-wide text-headline text-ink focus-visible:outline-none">{address.street_address}</h2>
        <p className="mt-1.5 text-ui text-ink-muted">
          {city}, {address.state} {address.zip}
          {address.county && <span> · {address.county}</span>}
        </p>
        {mailedDifferently && (
          <p className="mt-1 font-mono text-[0.75rem] text-ink">
            Mailed as {address.postal_city} <span className="text-accent">·</span> legally {city}
          </p>
        )}
      </div>
      <BuildingFacts address={address} />
    </header>
  );
}
