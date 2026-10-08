"use client";

import { useEffect, useRef } from "react";
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import { useHeroMotion } from "./hero-motion";
import { HERO_MOTION as T } from "./motion-tokens";

export function HeroBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const { canMove, visible } = useHeroMotion();
  const x = useMotionValue(50);
  const y = useMotionValue(20);
  const smoothX = useSpring(x, T.springs.spotlight);
  const smoothY = useSpring(y, T.springs.spotlight);
  const spotlightX = useMotionTemplate`${smoothX}%`;
  const spotlightY = useMotionTemplate`${smoothY}%`;
  useEffect(() => {
    const section = ref.current?.closest("section");
    if (!section || !canMove || !visible) {
      x.set(50);
      y.set(20);
      return;
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const bounds = section.getBoundingClientRect();
      x.set(((event.clientX - bounds.left) / bounds.width) * 100);
      y.set(((event.clientY - bounds.top) / bounds.height) * 100);
    };
    const reset = () => {
      x.set(50);
      y.set(20);
    };
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", reset);
    return () => {
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", reset);
    };
  }, [canMove, visible, x, y]);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="hero-grid absolute inset-0" />
      <div className="hero-noise absolute inset-0" />
      <m.div
        className="hero-spotlight absolute inset-0"
        style={
          {
            "--spotlight-x": spotlightX,
            "--spotlight-y": spotlightY,
          } as MotionStyle &
            Record<`--spotlight-${string}`, MotionValue<string>>
        }
      />
      <div className="from-background absolute inset-x-0 bottom-0 h-48 bg-linear-to-t to-transparent" />
    </div>
  );
}
