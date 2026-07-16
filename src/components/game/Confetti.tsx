"use client";

import { motion } from "motion/react";
import { useSettingsStore } from "@/stores/settingsStore";

const COLORS = [
  "#6366f1",
  "#22d3ee",
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#c084fc",
  "#fb923c",
];

/** Lightweight confetti burst (ported from the Figma export). */
export function Confetti() {
  const reduced = useSettingsStore((s) => s.reducedMotion);
  if (reduced) return null;

  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: 40 + ((i * 37) % 20) - 10,
    color: COLORS[i % COLORS.length],
    dx: ((i * 53) % 160) - 80,
    dy: -(((i * 29) % 120) + 60),
    size: 5 + ((i * 13) % 6),
    rotate: (i * 47) % 360,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: "50%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{
            opacity: [1, 1, 0],
            x: p.dx,
            y: p.dy,
            rotate: p.rotate,
            scale: [1, 1.2, 0.6],
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
