"use client";

import { motion } from "motion/react";

interface SurveyPlateProps {
  lat: number;
  lng: number;
  progress: number;
}

const RINGS = [36, 72, 120, 180];

export default function SurveyPlate({ lat, lng, progress }: SurveyPlateProps) {
  const zoom = 0.4 + 0.6 * progress;
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center overflow-hidden bg-paper">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--hairline) 1px, transparent 1px), linear-gradient(to bottom, var(--hairline) 1px, transparent 1px)",
          backgroundSize: `${48 * (1 + progress * 2)}px ${48 * (1 + progress * 2)}px`,
          backgroundPosition: "center",
        }}
      />
      <motion.svg width="420" height="420" viewBox="-210 -210 420 420" style={{ scale: zoom }}>
        {RINGS.map((r) => (
          <circle key={r} r={r} fill="none" stroke="var(--contour)" strokeOpacity="0.25" strokeDasharray={r > 100 ? "4 6" : undefined} />
        ))}
        <line x1="-200" x2="200" y1="0" y2="0" stroke="var(--ink)" strokeOpacity="0.3" />
        <line y1="-200" y2="200" x1="0" x2="0" stroke="var(--ink)" strokeOpacity="0.3" />
        <circle r="14" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <circle r="4" fill="var(--accent)" />
      </motion.svg>
      <p className="tnum absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[0.75rem] text-ink-muted">
        {lat.toFixed(5)}, {lng.toFixed(5)} · 3D imagery unavailable
      </p>
    </div>
  );
}
