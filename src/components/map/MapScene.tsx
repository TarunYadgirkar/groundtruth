"use client";

import { useEffect, useRef, useState } from "react";
import { AltitudeMode, Pin } from "@vis.gl/react-google-maps";
import { Map3D, MapMode, Marker3D, Polyline3D, type Map3DRef } from "@vis.gl/react-google-maps/3d";
import { reportMapFailure } from "./MapProvider";
import streetBearings from "./street-bearings.json";
import {
  ASCENT_MS,
  BUILDING_RANGE,
  BUILDING_TILT,
  DESCENT_MS,
  GLOBE,
  ORBIT_MS,
  SPIN_DEG_PER_SEC,
  applyCam,
  ascentAt,
  descentAt,
  driftAt,
  framed,
  framingWeight,
  headingFor,
  orbitAt,
  readCam,
  ringPath,
  type Cam,
  type ScreenOffset,
} from "./camera";

export interface FlightTarget {
  id: string;
  lat: number;
  lng: number;
  height: number;
}

interface MapSceneProps {
  target: FlightTarget | null;
  prewarm: boolean;
  offset: ScreenOffset;
  reducedMotion: boolean;
  interactive: boolean;
  showMarker: boolean;
  onProgress: (u: number) => void;
  onArrive: () => void;
}

type Mode =
  | { kind: "spin" }
  | { kind: "probe"; final: Cam; height: number }
  | { kind: "descend"; final: Cam; start: number }
  | { kind: "orbit"; base: Cam; start: number }
  | { kind: "drift"; base: Cam; start: number }
  | { kind: "ascend"; from: Cam; start: number }
  | { kind: "idle" };

const RING_METERS = 26;
const RING_LIFT = 6;
const PIN_LIFT = 40;
const PROGRESS_STEPS = 40;
const BEARINGS = streetBearings as Record<string, number>;

function finalCam(target: FlightTarget): Cam {
  return { lat: target.lat, lng: target.lng, range: BUILDING_RANGE, tilt: BUILDING_TILT, heading: headingFor(target.id, BEARINGS[target.id]) };
}

const PROBE_RANGE = 600;
const PROBE_SETTLE_MS = 1000;

// Behind the dark "Locating" screen, look straight down at the building. This
// streams the destination tiles in early, and once terrain has loaded the map
// snaps the look-at point onto the surface, which gives us the roof altitude.
function probe(map: google.maps.maps3d.Map3DElement, final: Cam): () => void {
  const look = () =>
    map.flyCameraTo({
      endCamera: { center: { lat: final.lat, lng: final.lng, altitude: 0 }, altitudeMode: "RELATIVE_TO_GROUND", range: PROBE_RANGE, tilt: 0, heading: final.heading },
      durationMillis: 0,
    });
  look();
  const t = window.setTimeout(look, PROBE_SETTLE_MS);
  return () => window.clearTimeout(t);
}

const MAX_ROOF_ABOVE_GROUND = 150;

// The probe asks for a camera PROBE_RANGE metres above the ground, so the camera's
// absolute altitude minus that range is the ground elevation. The look-at point
// usually snaps onto the roof; trust it only when it sits a plausible height above ground.
function measure(map: google.maps.maps3d.Map3DElement, height: number): { ground: number; roof: number } | null {
  const cam = map.cameraPosition;
  const camAlt = cam && typeof cam.altitude === "number" ? cam.altitude : NaN;
  const ground = camAlt - PROBE_RANGE;
  if (!Number.isFinite(ground) || ground < -100 || ground > 4000) return null;
  const surface = readCam(map).alt ?? NaN;
  const roof = surface > ground - 5 && surface < ground + MAX_ROOF_ABOVE_GROUND ? surface : ground + height;
  return { ground, roof: Math.max(roof, ground + height * 0.5) };
}

export default function MapScene({ target, prewarm, offset, reducedMotion, interactive, showMarker, onProgress, onArrive }: MapSceneProps) {
  const mapRef = useRef<Map3DRef | null>(null);
  const modeRef = useRef<Mode>({ kind: "spin" });
  const cbRef = useRef({ onProgress, onArrive });
  const stepRef = useRef(-1);
  const [roofAlt, setRoofAlt] = useState<number | null>(null);

  const offsetRef = useRef(offset);

  useEffect(() => {
    cbRef.current = { onProgress, onArrive };
    offsetRef.current = offset;
  });

  useEffect(() => {
    const map = mapRef.current?.map3d ?? null;
    const now = performance.now();
    if (!target) {
      if (!map || reducedMotion) {
        if (map) applyCam(map, GLOBE);
        modeRef.current = { kind: reducedMotion ? "idle" : "spin" };
        return;
      }
      modeRef.current = { kind: "ascend", from: readCam(map), start: now };
      return;
    }
    const final = finalCam(target);
    if (prewarm) {
      modeRef.current = { kind: "probe", final, height: target.height };
      return map ? probe(map, final) : undefined;
    }
    const m = map ? measure(map, target.height) : null;
    if (map) map.dataset.surface = m ? `${Math.round(m.ground)}/${Math.round(m.roof)}` : "none";
    const roof = m?.roof ?? target.height;
    const landed: Cam = { ...final, alt: m ? (m.ground + roof) / 2 : target.height };
    const arrive = () => {
      setRoofAlt(roof + RING_LIFT);
      cbRef.current.onProgress(1);
      cbRef.current.onArrive();
    };
    if (reducedMotion) {
      if (map) applyCam(map, framed(landed, offsetRef.current, 1));
      modeRef.current = { kind: "idle" };
      arrive();
      return;
    }
    if (map) applyCam(map, descentAt(landed, GLOBE.range, 0));
    stepRef.current = -1;
    modeRef.current = { kind: "descend", final: landed, start: now };
    const t = window.setTimeout(arrive, DESCENT_MS);
    return () => window.clearTimeout(t);
  }, [target, prewarm, reducedMotion]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const map = mapRef.current?.map3d ?? null;
      const mode = modeRef.current;
      if (map) step(map, mode, now, dt);
      raf = requestAnimationFrame(tick);
    };
    const step = (map: google.maps.maps3d.Map3DElement, mode: Mode, now: number, dt: number) => {
      if (mode.kind === "spin" && !reducedMotion) {
        const cam = readCam(map);
        applyCam(map, { ...GLOBE, lng: cam.lng - (SPIN_DEG_PER_SEC * dt) / 1000 });
      } else if (mode.kind === "descend") {
        const u = Math.min(1, (now - mode.start) / DESCENT_MS);
        const cam = descentAt(mode.final, GLOBE.range, u);
        applyCam(map, framed(cam, offsetRef.current, framingWeight(cam, mode.final)));
        const s = Math.floor(u * PROGRESS_STEPS);
        if (s !== stepRef.current) {
          stepRef.current = s;
          cbRef.current.onProgress(u);
        }
        if (u >= 1) modeRef.current = { kind: "orbit", base: mode.final, start: now };
      } else if (mode.kind === "orbit") {
        const u = Math.min(1, (now - mode.start) / ORBIT_MS);
        applyCam(map, framed(orbitAt(mode.base, u), offsetRef.current, 1));
        if (u >= 1) modeRef.current = { kind: "drift", base: mode.base, start: now };
      } else if (mode.kind === "drift") {
        applyCam(map, framed(driftAt(mode.base, (now - mode.start) / 1000), offsetRef.current, 1));
      } else if (mode.kind === "ascend") {
        const u = Math.min(1, (now - mode.start) / ASCENT_MS);
        applyCam(map, ascentAt(mode.from, { ...GLOBE, lng: mode.from.lng }, u));
        if (u >= 1) modeRef.current = { kind: "spin" };
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const stopOrbit = () => {
    const k = modeRef.current.kind;
    if (k === "orbit" || k === "drift") modeRef.current = { kind: "idle" };
  };

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={stopOrbit}
      onWheel={stopOrbit}
      onKeyDown={stopOrbit}
      onTouchStart={stopOrbit}
    >
      <Map3D
        ref={mapRef}
        mode={MapMode.SATELLITE}
        defaultCenter={{ lat: GLOBE.lat, lng: GLOBE.lng, altitude: 0 }}
        defaultRange={GLOBE.range}
        defaultTilt={0}
        defaultHeading={0}
        defaultLabelsDisabled
        onError={reportMapFailure}
        style={{ width: "100%", height: "100%" }}
      >
        {showMarker && target && roofAlt !== null && (
          <>
            <Polyline3D
              coordinates={ringPath(target.lat, target.lng, RING_METERS, roofAlt)}
              altitudeMode={AltitudeMode.ABSOLUTE}
              strokeColor="#C8452C"
              strokeWidth={5}
              outerColor="#FBFAF5"
              outerWidth={0.6}
            />
            <Marker3D position={{ lat: target.lat, lng: target.lng, altitude: roofAlt + PIN_LIFT }} altitudeMode={AltitudeMode.ABSOLUTE} extruded>
              <Pin background="#C8452C" borderColor="#1E2B26" glyphColor="#FBFAF5" />
            </Marker3D>
          </>
        )}
      </Map3D>
    </div>
  );
}
