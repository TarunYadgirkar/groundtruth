export interface Cam {
  lat: number;
  lng: number;
  range: number;
  tilt: number;
  heading: number;
  alt?: number;
}

export const GLOBE: Cam = { lat: 38.5, lng: -97, range: 7_500_000, tilt: 0, heading: 0 };
export const BUILDING_RANGE = 330;
export const BUILDING_TILT = 60;
export const DESCENT_MS = 8200;
export const ASCENT_MS = 2600;
export const ORBIT_DEG = 25;
export const ORBIT_MS = 18000;
export const DRIFT_DEG_PER_SEC = 0.35;
export const SPIN_DEG_PER_SEC = 1.6;
export const FACADE_OFFSET_DEG = 28;
const TILT_START_RANGE = 4500;
const SWEEP_START_RANGE = 250_000;
const FOV_DEG = 35;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t ** 2 * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

const sineInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const descentEase = cubicBezier(0.38, 0, 0.1, 1);

function window01(u: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (u - start) / (end - start)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function logWindow(range: number, from: number, to: number): number {
  return window01(Math.log(range), Math.log(from), Math.log(to));
}

// One continuous dive with the look-at point fixed on the building.
// Range falls exponentially (fast through the atmosphere, slow near the roofs);
// tilt and heading are keyed to altitude so they only ease in during the last few kilometres.
export function descentAt(final: Cam, startRange: number, u: number): Cam {
  const range = Math.exp(lerp(Math.log(startRange), Math.log(final.range), descentEase(u)));
  const tiltT = sineInOut(logWindow(range, TILT_START_RANGE, final.range));
  const sweepT = sineInOut(logWindow(range, SWEEP_START_RANGE, final.range));
  return {
    lat: final.lat,
    lng: final.lng,
    alt: final.alt,
    range,
    tilt: final.tilt * tiltT,
    heading: angleDelta(0, final.heading) * sweepT,
  };
}

// Weight for the off-centre framing: grows with tilt so the building drifts into
// the visible part of the screen as the camera levels out, never as a jump.
export function framingWeight(cam: Cam, final: Cam): number {
  return final.tilt > 0 ? Math.min(1, cam.tilt / final.tilt) : 1;
}

export interface ScreenOffset {
  x: number;
  y: number;
  viewportHeight: number;
}

// Move the look-at point so the target sits `x` px left of and `y` px above the
// viewport centre (the answer panel covers the right side or the bottom).
export function framed(cam: Cam, offset: ScreenOffset, weight: number): Cam {
  if (weight <= 0 || (offset.x === 0 && offset.y === 0)) return cam;
  const mpp = (2 * cam.range * Math.tan((FOV_DEG * Math.PI) / 360)) / offset.viewportHeight;
  const right = offset.x * mpp * weight;
  const back = (offset.y * mpp * weight) / Math.max(0.35, Math.cos((cam.tilt * Math.PI) / 180));
  const h = (cam.heading * Math.PI) / 180;
  const east = right * Math.cos(h) - back * Math.sin(h);
  const north = -right * Math.sin(h) - back * Math.cos(h);
  return {
    ...cam,
    lat: cam.lat + north / 111_320,
    lng: cam.lng + east / (111_320 * Math.cos((cam.lat * Math.PI) / 180)),
  };
}

export function ascentAt(from: Cam, to: Cam, u: number): Cam {
  const e = sineInOut(u);
  return {
    lat: lerp(from.lat, to.lat, e),
    lng: from.lng + angleDelta(from.lng, to.lng) * e,
    range: Math.exp(lerp(Math.log(from.range), Math.log(to.range), e)),
    tilt: lerp(from.tilt, to.tilt, Math.min(1, e * 2)),
    heading: from.heading + angleDelta(from.heading, to.heading) * e,
    alt: lerp(from.alt ?? 0, 0, e),
  };
}

export function orbitAt(base: Cam, u: number): Cam {
  return { ...base, heading: base.heading + ORBIT_DEG * sineInOut(u) };
}

export function driftAt(base: Cam, seconds: number): Cam {
  return { ...base, heading: base.heading + ORBIT_DEG + DRIFT_DEG_PER_SEC * seconds };
}

export function buildingHeight(units: number | null): number {
  if (units === null) return 10;
  if (units >= 50) return 24;
  if (units >= 12) return 15;
  return 8;
}

// Bearing from the street (Census point) to the rooftop, so the camera looks at the frontage.
export function headingFor(id: string, streetBearing: number | undefined): number {
  if (streetBearing !== undefined) return (streetBearing + FACADE_OFFSET_DEG + 360) % 360;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 3600;
  return (h / 10 + 15) % 360;
}

export function readCam(map: google.maps.maps3d.Map3DElement): Cam {
  const c = map.center;
  const lat = c ? (typeof c.lat === "function" ? (c.lat as () => number)() : (c.lat as number)) : GLOBE.lat;
  const lng = c ? (typeof c.lng === "function" ? (c.lng as () => number)() : (c.lng as number)) : GLOBE.lng;
  return {
    lat,
    lng,
    alt: c && typeof c.altitude === "number" ? c.altitude : 0,
    range: map.range ?? GLOBE.range,
    tilt: map.tilt ?? 0,
    heading: map.heading ?? 0,
  };
}

export function applyCam(map: google.maps.maps3d.Map3DElement, cam: Cam): void {
  map.center = { lat: cam.lat, lng: cam.lng, altitude: cam.alt ?? 0 };
  map.range = cam.range;
  map.tilt = cam.tilt;
  map.heading = cam.heading;
}

export function ringPath(lat: number, lng: number, meters: number, altitude: number, steps = 64): google.maps.LatLngAltitudeLiteral[] {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { lat: lat + dLat * Math.sin(a), lng: lng + dLng * Math.cos(a), altitude };
  });
}
