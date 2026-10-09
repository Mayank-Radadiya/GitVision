"use client";

/**
 * Code Viewer — Shiki theme selection.
 *
 * The theme is a single piece of state with two consumers: the code surface
 * renders with it, and the overflow menu picks it. Both used to own their own
 * copy of the mode-sync effect, which is how a mode flip could re-theme the
 * code while the menu still showed the old selection as current.
 *
 * The hook keeps one source of truth and the one non-obvious rule attached to
 * it: switching the *application* mode re-resolves to the stored theme for that
 * mode, but an explicit pick is persisted per mode so a reader who chose
 * Nord in dark and Min Light in light keeps both.
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  getResolvedShikiTheme,
  persistShikiTheme,
} from "./highlight";

export interface ShikiThemeSelection {
  /** Currently active Shiki theme id. */
  theme: string;
  /** Resolved application mode; "light" until next-themes hydrates. */
  mode: "dark" | "light";
  /** Pick a theme explicitly and persist it for the current mode. */
  selectTheme: (themeId: string) => void;
}

export function useShikiTheme(): ShikiThemeSelection {
  const { theme: systemTheme, resolvedTheme } = useTheme();

  const mode: "dark" | "light" =
    resolvedTheme === "light" || resolvedTheme === "dark"
      ? resolvedTheme
      : systemTheme === "dark"
        ? "dark"
        : "light";

  const [theme, setTheme] = useState<string>(() =>
    getResolvedShikiTheme(mode),
  );

  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    setTheme(getResolvedShikiTheme(mode));
  }, [mode]);

  const selectTheme = (themeId: string) => {
    setTheme(themeId);
    persistShikiTheme(themeId, mode);
  };

  return { theme, mode, selectTheme };
}

export default useShikiTheme;
