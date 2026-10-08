"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { HERO_MOTION as T } from "./motion-tokens";

/** Shared preferences; static rendering is the safe SSR default. */
export interface HeroMotionPreferences {
  reducedMotion: boolean;
  canMove: boolean;
  visible: boolean;
  ready: boolean;
}
export const HeroMotionContext = createContext<HeroMotionPreferences>({
  reducedMotion: true,
  canMove: false,
  visible: true,
  ready: false,
});
export const useHeroMotion = () => useContext(HeroMotionContext);

/** Receives server-rendered children rather than importing the server shell. */
export function HeroMotionProvider({ children }: { children: ReactNode }) {
  const preference = useReducedMotion();
  const [environment, setEnvironment] = useState({
    finePointer: false,
    reduce: preference !== false,
    visible: true,
    ready: false,
  });
  useEffect(() => {
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setEnvironment({
        finePointer: pointer.matches,
        reduce: reduce.matches,
        visible: !document.hidden,
        ready: true,
      });
    update();
    pointer.addEventListener("change", update);
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      pointer.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  // Motion 12 reads the preference once; keep later OS changes reactive too.
  const reducedMotion = !environment.ready || environment.reduce;
  const style = {
    "--hero-feedback": `${T.feedback}s`,
    "--hero-sweep": `${T.sweep}s`,
    "--hero-press": T.press,
  } as CSSProperties;
  return (
    <LazyMotion features={domAnimation} strict>
      <HeroMotionContext.Provider
        value={{
          reducedMotion,
          canMove: !reducedMotion && environment.finePointer,
          visible: environment.visible,
          ready: environment.ready,
        }}
      >
        <div className="contents" style={style}>
          {children}
        </div>
      </HeroMotionContext.Provider>
    </LazyMotion>
  );
}

/** SSR-visible entrance; the headline never fades or waits for JavaScript. */
export function HeroReveal({
  children,
  order,
  headline = false,
  className,
}: {
  children: ReactNode;
  /** Position in the entrance sequence. */
  order: number;
  headline?: boolean;
  className?: string;
}) {
  const { reducedMotion, ready } = useHeroMotion();
  const moving = ready && !reducedMotion;
  return (
    <m.div
      className={className}
      initial={false}
      animate={
        moving
          ? { y: [T.offset, 0], opacity: headline ? 1 : [T.entranceOpacity, 1] }
          : { y: 0, opacity: 1 }
      }
      transition={{
        duration: reducedMotion ? 0 : headline ? T.headline : T.entrance,
        delay: headline || reducedMotion ? 0 : order * T.stagger,
        ease: T.ease,
      }}
    >
      {children}
    </m.div>
  );
}

/** Keeps pointer sampling off React's render path. */
export function HeroMagnetic({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { canMove, visible } = useHeroMotion();
  const active = canMove && visible;
  const rect = useRef<DOMRect | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, T.springs.control);
  const springY = useSpring(y, T.springs.control);
  useEffect(() => {
    if (!active) {
      x.set(0);
      y.set(0);
    }
  }, [active, x, y]);
  return (
    <m.div
      className={`hero-pointer-motion inline-flex ${className}`}
      style={{ x: active ? springX : 0, y: active ? springY : 0 }}
      onPointerEnter={(event) => {
        rect.current = event.currentTarget.getBoundingClientRect();
      }}
      onPointerMove={(event) => {
        if (!active || event.pointerType !== "mouse" || !rect.current) return;
        const bounds = rect.current;
        const clamp = (value: number) =>
          Math.max(-T.magnetic, Math.min(T.magnetic, value));
        x.set(
          clamp(
            ((event.clientX - bounds.left) / bounds.width - 0.5) *
              T.magnetic *
              2,
          ),
        );
        y.set(
          clamp(
            ((event.clientY - bounds.top) / bounds.height - 0.5) *
              T.magnetic *
              2,
          ),
        );
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
        rect.current = null;
      }}
    >
      {children}
    </m.div>
  );
}
