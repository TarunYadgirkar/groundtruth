"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

const PARALLAX_PX = 14;

function contourPath(cx: number, cy: number, r: number, seed: number): string {
  const steps = 72;
  const pts = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.09 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.1) + 0.03 * Math.cos(a * 7 + seed);
    return [cx + Math.cos(a) * r * 1.35 * wobble, cy + Math.sin(a) * r * wobble] as const;
  });
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
}

const CONTOURS = [
  ...Array.from({ length: 9 }, (_, i) => contourPath(1180, 220, 40 + i * 42, 1.3)),
  ...Array.from({ length: 7 }, (_, i) => contourPath(230, 820, 30 + i * 46, 4.1)),
];

interface SurveyBackdropProps {
  opacity: number;
}

export default function SurveyBackdrop({ opacity }: SurveyBackdropProps) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const gridX = useTransform(sx, (v) => v * 0.5);
  const gridY = useTransform(sy, (v) => v * 0.5);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      mx.set(((e.clientX / window.innerWidth) * 2 - 1) * -PARALLAX_PX);
      my.set(((e.clientY / window.innerHeight) * 2 - 1) * -PARALLAX_PX);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, mx, my]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      animate={{ opacity }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
    >
      <div className="absolute inset-0 bg-paper/70" />
      <motion.div className="absolute -inset-16" style={{ x: gridX, y: gridY }}>
        <div
          className="drift absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--hairline) 1px, transparent 1px), linear-gradient(to bottom, var(--hairline) 1px, transparent 1px), linear-gradient(to right, rgba(30,43,38,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,43,38,.05) 1px, transparent 1px)",
            backgroundSize: "240px 240px, 240px 240px, 48px 48px, 48px 48px",
          }}
        />
      </motion.div>
      <motion.svg
        className="absolute -inset-16 h-[calc(100%+8rem)] w-[calc(100%+8rem)]"
        viewBox="0 0 1440 1000"
        preserveAspectRatio="xMidYMid slice"
        style={{ x: sx, y: sy }}
      >
        <g className="drift" fill="none" stroke="var(--contour)" strokeOpacity="0.16" strokeWidth="1">
          {CONTOURS.map((d, i) => (
            <path key={i} d={d} strokeOpacity={i % 4 === 0 ? 0.28 : 0.14} />
          ))}
        </g>
      </motion.svg>
    </motion.div>
  );
}
