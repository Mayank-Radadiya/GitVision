"use client";

/**
 * useElementSize — the measured width of an element, in CSS pixels.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The activity chart used to render into a fixed 300-unit viewBox stretched with
 * `preserveAspectRatio="none"`. That stretches x and y by different factors,
 * and `vectorEffect="non-scaling-stroke"` only rescues *stroke* width — it does
 * nothing for text, dash spacing, or circles, all of which the replacement chart
 * needs. So the plot has to be drawn at real pixel dimensions, which means
 * knowing how many real pixels there are. Hence a `ResizeObserver`.
 *
 * ── Why the fallback width is a constant and not zero ───────────────────────
 * Three contexts have no measurement, and each would otherwise need its own
 * guard:
 *
 *   - **Server render.** No DOM at all.
 *   - **jsdom.** `setup.ts` polyfills `matchMedia` but not `ResizeObserver`, so
 *     `typeof ResizeObserver === "undefined"` in tests.
 *   - **First paint.** The observer has not fired yet even in a real browser.
 *
 * Rather than let the chart measure 0 and render a degenerate plot, it renders
 * at `FALLBACK_WIDTH` and then re-renders when the observer reports the truth.
 * A brief, correctly-proportioned chart that settles is better than a chart that
 * collapses and then springs open, and it means every consumer of this hook gets
 * a usable value synchronously instead of a nullable one it has to branch on.
 *
 * The fallback is wide because that is the layout the chart is designed for; a
 * chart rendered narrow on a phone before measurement still has correct
 * geometry, just denser.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Width used before measurement, and whenever measurement is unavailable. */
export const FALLBACK_WIDTH = 640;

export interface ElementSize {
  /** Width in CSS pixels. Never 0 — see `FALLBACK_WIDTH`. */
  width: number;
  /** Whether `width` came from a real measurement rather than the fallback. */
  measured: boolean;
  /**
   * Attach to the element to measure. A callback ref, so the observer is torn
   * down and re-attached if the element itself is replaced.
   */
  ref: (node: HTMLElement | null) => void;
}

export function useElementSize(): ElementSize {
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [measured, setMeasured] = useState(false);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) return;
    nodeRef.current = node;

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // `contentRect.width` excludes padding; `borderBoxSize` is not available
      // in older jsdom/Node and is a list in modern browsers, so the content
      // rect is the portable choice and matches what CSS `width: 100%` means
      // for the chart's own padding.
      const next = Math.round(entry.contentRect.width);
      if (next > 0) {
        setWidth(next);
        setMeasured(true);
      }
    });

    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return { width, measured, ref };
}