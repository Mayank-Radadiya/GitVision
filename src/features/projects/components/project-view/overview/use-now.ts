"use client";

/**
 * A clock that starts at `null` and becomes `Date.now()` after mount.
 *
 * ── Why not just call `new Date()` in a render ───────────────────────────────
 * The workspace is server-rendered (`prefetchProject` → `HydrateClient`), so a
 * render that reads the clock produces different text on the server and during
 * hydration whenever the clock has moved meaningfully in between. For values in
 * days or weeks the two strings usually match by accident and nobody notices.
 * For "last commit 1 min ago" they cannot match, and React logs a hydration
 * mismatch on every load.
 *
 * `suppressHydrationWarning` is the reflex fix and it is wrong here: it silences
 * the warning but leaves the *server's* string in the DOM. The feed would show a
 * stale age until some unrelated state change forced a re-render, which for a
 * live "what just happened" band is the exact opposite of the intent.
 *
 * So callers get `null` for the first paint, render something that is true
 * regardless of clock (an absolute date, or nothing at all), and swap to the
 * clock-relative form in the effect pass. The cost is one extra render of the
 * affected subtree on load, which lands while the band is still below the fold.
 *
 * `typeof window === "undefined"` is deliberately *not* the guard here — that
 * only distinguishes SSR from the browser, not the server pass from the hydration
 * pass, which are both in a browser and are the two that actually disagree.
 */

import { useEffect, useState } from "react";

export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  return now;
}
