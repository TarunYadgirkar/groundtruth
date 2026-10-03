"use client";

import { useEffect, useRef } from "react";
import { AltitudeMode, Pin } from "@vis.gl/react-google-maps";
import { Map3D, MapMode, Marker3D, Polyline3D, type Map3DRef } from "@vis.gl/react-google-maps/3d";
import { reportMapFailure } from "./MapProvider";
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
  | { kind: "descend"; from: Cam; to: Cam; start: number }
  | { kind: "orbit"; base: Cam; start: number }
  | { kind: "ascend"; from: Cam; start: number }
  | { kind: "idle" };

const RING_METERS = 26;

export default function MapScene({ target, reducedMotion, interactive, showMarker, onProgress, onArrive }: MapSceneProps) {
  const mapRef = useRef<Map3DRef | null>(null);
  const modeRef = useRef<Mode>({ kind: "spin" });
  const cbRef = useRef({ onProgress, onArrive });

  useEffect(() => {
    cbRef.current = { onProgress, onArrive };
  });

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
    const to: Cam = { lat: target.lat, lng: target.lng, range: BUILDING_RANGE, tilt: BUILDING_TILT, heading: headingFor(target.id) };
    if (reducedMotion) {
      if (map) applyCam(map, to);
      modeRef.current = { kind: "idle" };
      cbRef.current.onProgress(1);
      cbRef.current.onArrive();
      return;
    }
    const from = map ? readCam(map) : GLOBE;
    modeRef.current = { kind: "descend", from: { ...from, tilt: 0 }, to, start: now };
  }, [target, reducedMotion]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
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
        if (u >= 1) {
          modeRef.current = { kind: "orbit", base: mode.to, start: now };
          cbRef.current.onArrive();
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
  }, [reducedMotion]);

  const stopOrbit = () => {
    if (modeRef.current.kind === "orbit") modeRef.current = { kind: "idle" };
  };

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={stopOrbit}
      onWheel={stopOrbit}
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
        {showMarker && target && (
          <>
            <Polyline3D
              coordinates={ringPath(target.lat, target.lng, RING_METERS)}
              altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
              strokeColor="#C8452C"
              strokeWidth={6}
              outerColor="#FBFAF5"
              outerWidth={0.5}
              drawsOccludedSegments
            />
            <Marker3D
              position={{ lat: target.lat, lng: target.lng, altitude: 60 }}
              altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
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

