"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { ADDRESSES, evaluate, rulesForPlace } from "@/lib/data";
import { geocodeFreeText, locate } from "@/lib/geocode";
import { DEFAULT_AS_OF } from "@/lib/labels";
import type { Address } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media";
import Landing from "./landing/Landing";
import SurveyBackdrop from "./landing/SurveyBackdrop";
import FlightHud from "./flight/FlightHud";
import TopBar from "./flight/TopBar";
import AnswerPanel from "./panel/AnswerPanel";
import { useMapFailed } from "./map/MapProvider";
import SurveyPlate from "./map/SurveyPlate";
import { buildingHeight } from "./map/camera";

const MapScene = dynamic(() => import("./map/MapScene"), { ssr: false });

type Phase = "landing" | "exiting" | "locating" | "flying" | "revealed";

interface Selection {
  address: Address;
  lat: number;
  lng: number;
}

const EXIT_MS = 350;
const DARK_MS = 450;
const LANDING_FILTER = "grayscale(0.85) sepia(0.18) contrast(0.92) brightness(1.04)";

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

const GEOCODER_WAIT_MS = 8000;
const GEOCODER_POLL_MS = 100;

function writeUrl(sel: Selection | null, asOf: string) {
  const url = new URL(window.location.href);
  const current = url.searchParams.get("a");
  url.search = "";
  const id = sel && !sel.address.address_id.startsWith("live-") ? sel.address.address_id : null;
  if (id) {
    url.searchParams.set("a", id);
    url.searchParams.set("asOf", asOf);
  }
  if (url.href === window.location.href) return;
  const isNewPlace = id !== null && id !== current;
  if (isNewPlace) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

function readUrl(): { address: Address | null; asOf: string | null } {
  const params = new URLSearchParams(window.location.search);
  const d = params.get("asOf");
  return {
    address: ADDRESSES.find((x) => x.address_id === params.get("a")) ?? null,
    asOf: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
  };
}

export default function Navigator() {
  const reduce = useReducedMotion() ?? false;
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const mapFailed = useMapFailed();
  const geocodingLib = useMapsLibrary("geocoding");
  const geocoder = useMemo(() => (geocodingLib ? new geocodingLib.Geocoder() : null), [geocodingLib]);

  const [phase, setPhase] = useState<Phase>("landing");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [asOf, setAsOf] = useState(DEFAULT_AS_OF);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);
  const geocoderRef = useRef(geocoder);

  useEffect(() => {
    geocoderRef.current = geocoder;
  }, [geocoder]);

  const waitForGeocoder = useCallback(async () => {
    for (let waited = 0; !geocoderRef.current && waited < GEOCODER_WAIT_MS; waited += GEOCODER_POLL_MS) await wait(GEOCODER_POLL_MS);
    return geocoderRef.current;
  }, []);

  const fly = useCallback(
    async (resolve: () => Promise<Selection | string>) => {
      const id = ++runId.current;
      setError(null);
      setPhase("exiting");
      const pending = resolve().catch(() => "Something went wrong placing that address. Try again.");
      await wait(reduce ? 0 : EXIT_MS);
      if (id !== runId.current) return;
      setPhase("locating");
      const [outcome] = await Promise.all([pending, wait(reduce ? 0 : DARK_MS)]);
      if (id !== runId.current) return;
      if (typeof outcome === "string") {
        setPhase("landing");
        setError(outcome);
        return;
      }
      setProgress(0);
      setSelection(outcome);
      setPhase("flying");
    },
    [reduce],
  );

  const selectSample = useCallback(
    (address: Address) =>
      fly(async () => {
        if (address.lat !== null && address.lng !== null) return { address, lat: address.lat, lng: address.lng };
        const g = await waitForGeocoder();
        const coords = g ? await locate(g, address) : null;
        if (!coords) return "We couldn't place this address on the map. Try another address, or check your connection.";
        return { address, ...coords };
      }),
    [fly, waitForGeocoder],
  );

  const lookupFree = useCallback(
    (query: string) =>
      fly(async () => {
        const g = await waitForGeocoder();
        if (!g) return "Address lookup isn't available right now. Pick one of the sample buildings instead.";
        const out = await geocodeFreeText(g, query);
        if (!out.ok) return out.reason;
        return { address: out.address, lat: out.address.lat as number, lng: out.address.lng as number };
      }),
    [fly, waitForGeocoder],
  );

  useEffect(() => {
    const { address, asOf: d } = readUrl();
    if (!address) return;
    const t = window.setTimeout(() => {
      if (d) setAsOf(d);
      selectSample(address);
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "revealed") writeUrl(selection, asOf);
  }, [phase, selection, asOf]);

  const [returned, setReturned] = useState(false);

  const reset = useCallback(() => {
    runId.current++;
    setReturned(true);
    setSelection(null);
    setPhase("landing");
    if (window.location.search) window.history.pushState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const { address, asOf: d } = readUrl();
      if (!address) {
        runId.current++;
        setSelection(null);
        setPhase("landing");
        return;
      }
      if (d) setAsOf(d);
      selectSample(address);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [selectSample]);

  const onArrive = useCallback(() => setPhase("revealed"), []);

  const evaluations = useMemo(() => (selection ? evaluate(selection.address, asOf) : []), [selection, asOf]);
  const ruleCount = useMemo(() => (selection ? rulesForPlace(selection.address).length : 0), [selection]);

  const inFlight = phase === "flying" || phase === "revealed";
  const target = useMemo(
    () => (selection && inFlight ? { id: selection.address.address_id, lat: selection.lat, lng: selection.lng, height: buildingHeight(selection.address.units) } : null),
    [selection, inFlight],
  );
  const scrim = phase === "locating" ? 0.94 : phase === "flying" && !mapFailed ? 0.55 * (1 - Math.min(1, progress * 1.4)) : 0;
  const mapShift = phase === "revealed" ? (isDesktop ? "translateX(calc(var(--panel-w) / -2))" : "translateY(-34dvh)") : "none";

  return (
    <div className={`relative h-dvh w-full overflow-hidden ${mapFailed ? "bg-paper" : "bg-night"} [--panel-w:clamp(420px,35vw,540px)]`} data-phase={phase}>
      <div
        className="absolute inset-0 transition-[transform,filter] duration-[1400ms] ease-[var(--ease-out)]"
        style={{ transform: mapShift, filter: phase === "landing" || phase === "exiting" ? LANDING_FILTER : "none" }}
      >
        <div className="absolute inset-0" style={{ opacity: mapFailed ? 0 : 1 }}>
        <MapScene
          target={target}
          reducedMotion={reduce}
          interactive={phase === "revealed"}
          showMarker={phase === "revealed"}
          onProgress={setProgress}
          onArrive={onArrive}
        />
        </div>
        {mapFailed && selection && inFlight && <SurveyPlate lat={selection.lat} lng={selection.lng} progress={phase === "revealed" ? 1 : progress} />}
      </div>

      <SurveyBackdrop opacity={phase === "landing" ? 1 : 0} />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-night"
        initial={false}
        animate={{ opacity: scrim }}
        transition={{ duration: phase === "flying" ? 0.25 : 0.4, ease: [0.2, 0, 0, 1] }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-transform duration-[1400ms] ease-[var(--ease-out)]"
        style={{
          transform: mapShift,
          background: "radial-gradient(circle at 50% 50%, transparent 0, transparent 14%, rgba(18,26,23,0.32) 46%, rgba(18,26,23,0.55) 100%)",
        }}
        initial={false}
        animate={{ opacity: phase === "revealed" ? 1 : 0 }}
        transition={{ duration: 1.2, ease: [0.2, 0, 0, 1] }}
      />

      <AnimatePresence>
        {phase === "landing" && <Landing key="landing" onSelect={selectSample} onLookupFree={lookupFree} error={error} autoFocus={returned} />}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "locating" && (
          <motion.div
            key="locating"
            role="status"
            className="absolute inset-0 z-20 grid place-items-center font-mono text-[0.75rem] uppercase tracking-[0.12em] text-paper/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            Locating property…
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "flying" && selection && !reduce && (
        <FlightHud address={selection.address} lat={selection.lat} lng={selection.lng} ruleCount={ruleCount} progress={progress} onPaper={mapFailed} />
      )}

      <AnimatePresence>
        {inFlight && selection && <TopBar key="top" address={selection.address} onSearch={reset} dark={phase === "flying"} />}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "revealed" && selection && (
          <AnswerPanel
            key={selection.address.address_id}
            address={selection.address}
            lat={selection.lat}
            lng={selection.lng}
            asOf={asOf}
            onAsOfChange={setAsOf}
            evaluations={evaluations}
            ruleCount={ruleCount}
            isDesktop={isDesktop}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
