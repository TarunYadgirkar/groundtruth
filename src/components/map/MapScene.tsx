"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AltitudeMode, Pin } from "@vis.gl/react-google-maps";
import { Map3D, MapMode, Marker3D, Polyline3D, type Map3DRef } from "@vis.gl/react-google-maps/3d";
import { reportMapFailure } from "./MapProvider";
import {
  ASCENT_MS,
  BUILDING_RANGE,
  BUILDING_TILT,
  DESCENT_MS,
  FINAL_MS,
  HANDOFF_RANGE,
  HANDOFF_TILT,
  GLOBE,
  ORBIT_MS,
  SPIN_DEG_PER_SEC,
  applyCam,
  ascentAt,
  descentAt,
  headingFor,
  orbitAt,
  readCam,
  ringPath,
  type Cam,
} from "./camera";

export interface FlightTarget {
  id: string;
  lat: number;
  lng: number;
  height: number;
}

interface MapSceneProps {
  target: FlightTarget | null;
  reducedMotion: boolean;
  interactive: boolean;
  showMarker: boolean;
  onProgress: (u: number) => void;
  onArrive: () => void;
}

type Mode =
  | { kind: "spin" }
  | { kind: "descend"; from: Cam; to: Cam; start: number; final: Cam; height: number }
  | { kind: "final"; final: Cam }
  | { kind: "orbit"; base: Cam; start: number }
  | { kind: "ascend"; from: Cam; start: number }
  | { kind: "idle" };

const RING_METERS = 26;

export default function MapScene({ target, reducedMotion, interactive, showMarker, onProgress, onArrive }: MapSceneProps) {
  const mapRef = useRef<Map3DRef | null>(null);
  const modeRef = useRef<Mode>({ kind: "spin" });
  const cbRef = useRef({ onProgress, onArrive });
  const [roofAlt, setRoofAlt] = useState<number | null>(null);

  useEffect(() => {
    cbRef.current = { onProgress, onArrive };
  });

  const landAt = useCallback((map: google.maps.maps3d.Map3DElement, final: Cam, height: number, durationMillis: number) => {
    let done = false;
    const arrive = () => {
      if (done || modeRef.current.kind !== "final") return;
      done = true;
      map.removeEventListener("gmp-animationend", arrive);
      const base = readCam(map);
      setRoofAlt((base.alt ?? 0) + 6);
      modeRef.current = reducedMotion ? { kind: "idle" } : { kind: "orbit", base, start: performance.now() };
      cbRef.current.onProgress(1);
      cbRef.current.onArrive();
    };
    map.addEventListener("gmp-animationend", arrive);
    window.setTimeout(arrive, durationMillis + 1500);
    map.flyCameraTo({
      endCamera: { center: { lat: final.lat, lng: final.lng, altitude: height }, altitudeMode: "RELATIVE_TO_GROUND", range: final.range, tilt: final.tilt, heading: final.heading },
      durationMillis,
    });
  }, [reducedMotion]);

  useEffect(() => {
    const map = mapRef.current?.map3d;
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
    const heading = headingFor(target.id);
    const final: Cam = { lat: target.lat, lng: target.lng, range: BUILDING_RANGE, tilt: BUILDING_TILT, heading };
    if (reducedMotion) {
      modeRef.current = { kind: "final", final };
      if (map) landAt(map, final, target.height, 0);
      return;
    }
    const handoff: Cam = { lat: target.lat, lng: target.lng, range: HANDOFF_RANGE, tilt: HANDOFF_TILT, heading };
    const from = map ? readCam(map) : GLOBE;
    modeRef.current = { kind: "descend", from: { ...from, tilt: 0, alt: 0 }, to: handoff, start: now, final, height: target.height };
  }, [target, reducedMotion, landAt]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const map = mapRef.current?.map3d ?? null;
      const mode = modeRef.current;
      if (mode.kind === "spin" && map && !reducedMotion) {
        const cam = readCam(map);
        applyCam(map, { ...GLOBE, lat: GLOBE.lat, lng: cam.lng - (SPIN_DEG_PER_SEC * dt) / 1000 });
      }
      if (mode.kind === "descend") {
        const u = Math.min(1, (now - mode.start) / DESCENT_MS);
        if (map) applyCam(map, descentAt(mode.from, mode.to, u));
        cbRef.current.onProgress(u);
        if (u >= 1 && map) {
          modeRef.current = { kind: "final", final: mode.final };
          landAt(map, mode.final, mode.height, FINAL_MS);
        }
      }
      if (mode.kind === "orbit" && map) {
        const u = Math.min(1, (now - mode.start) / ORBIT_MS);
        applyCam(map, orbitAt(mode.base, u));
        if (u >= 1) modeRef.current = { kind: "idle" };
      }
      if (mode.kind === "ascend" && map) {
        const u = Math.min(1, (now - mode.start) / ASCENT_MS);
        applyCam(map, ascentAt(mode.from, { ...GLOBE, lng: mode.from.lng }, u));
        if (u >= 1) modeRef.current = { kind: "spin" };
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, landAt]);

  const stopOrbit = () => {
    if (modeRef.current.kind === "orbit") modeRef.current = { kind: "idle" };
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
        {showMarker && target && roofAlt !== null && (
          <>
            <Polyline3D
              path={ringPath(target.lat, target.lng, RING_METERS, roofAlt)}
              altitudeMode={AltitudeMode.ABSOLUTE}
              strokeColor="#C8452C"
              strokeWidth={5}
              outerColor="#FBFAF5"
              outerWidth={0.6}
            />
            <Marker3D
              position={{ lat: target.lat, lng: target.lng, altitude: roofAlt + 40 }}
              altitudeMode={AltitudeMode.ABSOLUTE}
              extruded
            >
              <Pin background="#C8452C" borderColor="#1E2B26" glyphColor="#FBFAF5" />
            </Marker3D>
          </>
        )}
      </Map3D>
    </div>
  );
}

