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
export const HANDOFF_RANGE = 2400;
export const HANDOFF_TILT = 38;
export const DESCENT_MS = 6200;
export const FINAL_MS = 3400;
export const ASCENT_MS = 2600;
export const ORBIT_DEG = 26;
export const ORBIT_MS = 16000;
export const SPIN_DEG_PER_SEC = 1.6;

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

const rangeEase = cubicBezier(0.45, 0, 0.55, 0.92);
const centerEase = cubicBezier(0.35, 0, 0.2, 1);
const sineInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

function window01(u: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (u - start) / (end - start)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function descentAt(from: Cam, to: Cam, u: number): Cam {
  const r = rangeEase(u);
  const c = centerEase(window01(u, 0, 0.55));
  const turn = sineInOut(window01(u, 0.45, 1));
  return {
    lat: lerp(from.lat, to.lat, c),
    lng: from.lng + angleDelta(from.lng, to.lng) * c,
    range: Math.exp(lerp(Math.log(from.range), Math.log(to.range), r)),
    tilt: lerp(from.tilt, to.tilt, sineInOut(window01(u, 0.5, 1))),
    heading: from.heading + angleDelta(from.heading, to.heading) * turn,
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

export function buildingHeight(units: number | null): number {
  if (units === null) return 10;
  if (units >= 50) return 24;
  if (units >= 12) return 15;
  return 8;
}

export function headingFor(id: string): number {
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
