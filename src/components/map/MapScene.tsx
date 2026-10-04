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
  HOP_MS,
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
  style: "cinematic" | "hop";
}

interface MapSceneProps {
  target: FlightTarget | null;
  prewarm: boolean;
  offset: ScreenOffset;
  skip: boolean;
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
  | { kind: "hop"; start: number; duration: number }
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
const INSTANT_SETTLE_MS = 200;
const HOP_GRACE_MS = 1500;
const MAP_WAIT_MS = 6000;
const GROUND_RETRIES = 12;
const GROUND_RETRY_MS = 250;

// Short hop for later lookups: Google's own fly-to arcs over the city and lands
// relative to the ground, so no probe is needed.
function hop(map: google.maps.maps3d.Map3DElement, final: Cam, offset: ScreenOffset, height: number, durationMillis: number): void {
  const end = framed(final, offset, 1);
  map.stopCameraAnimation();
  map.flyCameraTo({
    endCamera: { center: { lat: end.lat, lng: end.lng, altitude: height / 2 }, altitudeMode: "RELATIVE_TO_GROUND", range: final.range, tilt: final.tilt, heading: final.heading },
    durationMillis,
  });
}

// After a hop, the camera sits range·cos(tilt) above a look-at point that is height/2 above ground.
function groundAfterHop(map: google.maps.maps3d.Map3DElement, final: Cam, height: number): number | null {
  const cam = map.cameraPosition;
  const camAlt = cam && typeof cam.altitude === "number" ? cam.altitude : NaN;
  const ground = camAlt - final.range * Math.cos((final.tilt * Math.PI) / 180) - height / 2;
  return Number.isFinite(ground) && ground > -100 && ground < 4000 ? ground : null;
}

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

export default function MapScene({ target, prewarm, offset, skip, reducedMotion, interactive, showMarker, onProgress, onArrive }: MapSceneProps) {
  const mapRef = useRef<Map3DRef | null>(null);
  const readyRef = useRef(false);
  const modeRef = useRef<Mode>({ kind: "spin" });
  const cbRef = useRef({ onProgress, onArrive });
  const stepRef = useRef(-1);
  const [ring, setRing] = useState<{ alt: number; relative: boolean } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const offsetRef = useRef(offset);
  const measuredRef = useRef<{ id: string; m: ReturnType<typeof measure> } | null>(null);

  useEffect(() => {
    cbRef.current = { onProgress, onArrive };
    offsetRef.current = offset;
  });

  useEffect(() => {
    const map = mapRef.current?.map3d ?? null;
    const now = performance.now();
    if (!target) {
      if (modeRef.current.kind === "spin") return;
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
    const instant = skip || reducedMotion;
    // A deep link can land before the 3D map element exists. Wait for it, but still
    // reveal the panel if the map never shows up.
    if (!map && !mapReady) {
      const t = window.setTimeout(() => {
        setRing({ alt: target.height + RING_LIFT, relative: true });
        cbRef.current.onProgress(1);
        cbRef.current.onArrive();
      }, MAP_WAIT_MS);
      return () => window.clearTimeout(t);
    }
    const land = (base: Cam, roof: number) => {
      if (map) applyCam(map, framed(base, offsetRef.current, 1));
      modeRef.current = reducedMotion ? { kind: "idle" } : { kind: "orbit", base, start: performance.now() };
      setRing({ alt: roof + RING_LIFT, relative: false });
      cbRef.current.onProgress(1);
      cbRef.current.onArrive();
    };
    // Terrain never reported an elevation: keep the hop's ground-relative camera and
    // hang the ring at building height above whatever the ground is.
    const landOnGround = () => {
      modeRef.current = { kind: "idle" };
      setRing({ alt: target.height + RING_LIFT, relative: true });
      cbRef.current.onProgress(1);
      cbRef.current.onArrive();
    };

    // Reduced motion lands with a zero-length ground-relative hop: there is no probe
    // window to measure terrain in, and the hop needs none.
    if (map && (target.style === "hop" || reducedMotion)) {
      let done = false;
      let retry = 0;
      const finish = (tries = 0) => {
        if (done) return;
        const ground = groundAfterHop(map, final, target.height);
        if (ground == null && tries < GROUND_RETRIES) {
          // A zero-length fly-to is dropped while the map is still initializing; ask again.
          if (instant) hop(map, final, offsetRef.current, target.height, 0);
          retry = window.setTimeout(() => finish(tries + 1), GROUND_RETRY_MS);
          return;
        }
        done = true;
        if (ground == null) landOnGround();
        else land({ ...final, alt: ground + target.height / 2 }, ground + target.height);
      };
      const duration = instant ? 0 : HOP_MS;
      hop(map, final, offsetRef.current, target.height, duration);
      stepRef.current = -1;
      modeRef.current = { kind: "hop", start: now, duration };
      const onEnd = () => !instant && finish();
      map.addEventListener("gmp-animationend", onEnd);
      const t = window.setTimeout(finish, instant ? INSTANT_SETTLE_MS : HOP_MS + HOP_GRACE_MS);
      return () => {
        map.removeEventListener("gmp-animationend", onEnd);
        window.clearTimeout(t);
        window.clearTimeout(retry);
      };
    }

    if (measuredRef.current?.id !== target.id) {
      measuredRef.current = { id: target.id, m: map ? measure(map, target.height) : null };
    }
    const m = measuredRef.current.m;
    if (map) map.dataset.surface = m ? `${Math.round(m.ground)}/${Math.round(m.roof)}` : "none";
    const roof = m?.roof ?? target.height;
    const landed: Cam = { ...final, alt: m ? (m.ground + roof) / 2 : target.height };
    if (instant) {
      land(landed, roof);
      return;
    }
    if (map) applyCam(map, descentAt(landed, GLOBE.range, 0));
    stepRef.current = -1;
    modeRef.current = { kind: "descend", final: landed, start: now };
    const t = window.setTimeout(() => land(landed, roof), DESCENT_MS);
    return () => window.clearTimeout(t);
  }, [target, prewarm, skip, reducedMotion, mapReady]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const map = mapRef.current?.map3d ?? null;
      const mode = modeRef.current;
      if (map && !readyRef.current) {
        readyRef.current = true;
        setMapReady(true);
      }
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
      } else if (mode.kind === "hop") {
        const u = mode.duration > 0 ? Math.min(1, (now - mode.start) / mode.duration) : 1;
        const s = Math.floor(u * PROGRESS_STEPS);
        if (s !== stepRef.current) {
          stepRef.current = s;
          cbRef.current.onProgress(u);
        }
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
      inert={!interactive}
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
        defaultUIHidden={!interactive}
        onError={reportMapFailure}
        style={{ width: "100%", height: "100%" }}
      >
        {showMarker && target && ring !== null && (
          <>
            <Polyline3D
              path={ringPath(target.lat, target.lng, RING_METERS, ring.alt)}
              altitudeMode={ring.relative ? AltitudeMode.RELATIVE_TO_GROUND : AltitudeMode.ABSOLUTE}
              strokeColor="#C8452C"
              strokeWidth={5}
              outerColor="#FBFAF5"
              outerWidth={0.6}
            />
            <Marker3D position={{ lat: target.lat, lng: target.lng, altitude: ring.alt + PIN_LIFT }} altitudeMode={ring.relative ? AltitudeMode.RELATIVE_TO_GROUND : AltitudeMode.ABSOLUTE} extruded>
              <Pin background="#C8452C" borderColor="#1E2B26" glyphColor="#FBFAF5" />
            </Marker3D>
          </>
        )}
      </Map3D>
    </div>
  );
}
