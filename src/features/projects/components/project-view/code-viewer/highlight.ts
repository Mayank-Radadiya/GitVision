/**
 * Code Panel — Shiki singleton and caches.
 *
 * Highlighting is module state rather than panel state: the highlighter takes
 * long enough to construct that rebuilding it per file would reintroduce the
 * shimmer on every navigation. The panel owns selection and rendering; this
 * module owns the warm highlighter, bounded HTML cache, and theme persistence.
 */

import type { Highlighter, BundledLanguage, BundledTheme } from "shiki";
import { CODE_THEMES } from "./utils";

export const STORAGE_KEY_PREFIX = "gitvision:shiki-theme:";
export const LEGACY_STORAGE_KEY = "gitvision-shiki-theme";

export const DEFAULT_THEMES: Record<"dark" | "light", string> = {
  dark: "github-dark",
  light: "github-light",
};

const themeCache = new Map<"dark" | "light", string>([
  ["dark", "github-dark"],
  ["light", "github-light"],
]);

function initThemeCache(): void {
  if (typeof window === "undefined") return;
  try {
    const savedDark = localStorage.getItem(`${STORAGE_KEY_PREFIX}dark`);
    if (savedDark && CODE_THEMES.some((t) => t.id === savedDark)) {
      themeCache.set("dark", savedDark);
    }
    const savedLight = localStorage.getItem(`${STORAGE_KEY_PREFIX}light`);
    if (savedLight && CODE_THEMES.some((t) => t.id === savedLight)) {
      themeCache.set("light", savedLight);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const match = CODE_THEMES.find((t) => t.id === legacy);
      if (match) themeCache.set(match.type, match.id);
    }
  } catch {
    // Ignore storage errors in restricted contexts (e.g. incognito)
  }
}
initThemeCache();

/** Retrieve the resolved Shiki theme for a given next-themes mode. */
export function getResolvedShikiTheme(mode: "dark" | "light"): string {
  return themeCache.get(mode) ?? DEFAULT_THEMES[mode];
}

/** Persist explicit user theme choice across file switches and reloads. */
export function persistShikiTheme(themeId: string, currentMode: "dark" | "light"): void {
  const match = CODE_THEMES.find((t) => t.id === themeId);
  themeCache.set(currentMode, themeId);
  if (match) themeCache.set(match.type, themeId);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${currentMode}`, themeId);
      if (match) localStorage.setItem(`${STORAGE_KEY_PREFIX}${match.type}`, themeId);
      localStorage.setItem(LEGACY_STORAGE_KEY, themeId);
    } catch {
      // Ignore storage errors
    }
  }
}

let highlighterSingleton: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

const PRELOADED_THEMES = [
  "github-dark",
  "github-light",
  "one-dark-pro",
  "dracula",
  "nord",
  "min-light",
  "vitesse-dark",
  "tokyo-night",
] as const;

const PRELOADED_LANGS = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "markdown",
  "css",
  "html",
  "python",
  "bash",
  "text",
] as const;

export async function getOrInitHighlighter(): Promise<Highlighter> {
  if (highlighterSingleton) return highlighterSingleton;
  if (!highlighterPromise) {
    highlighterPromise = import("shiki")
      .then(async ({ getSingletonHighlighter }) => {
        const instance = await getSingletonHighlighter({
          themes: [...PRELOADED_THEMES],
          langs: [...PRELOADED_LANGS],
        });
        highlighterSingleton = instance;
        return instance;
      })
      .catch((err) => {
        highlighterPromise = null;
        throw err;
      });
  }
  return highlighterPromise;
}

/** Whether the shared highlighter is warm enough to skip the shimmer. */
export function isHighlighterReady(): boolean {
  return highlighterSingleton !== null;
}

const MAX_HIGHLIGHT_CACHE = 100;
const highlightCache = new Map<string, string>();

export function getHighlightCacheKey(theme: string, lang: string, content: string): string {
  return `${theme}::${lang}::${content}`;
}

export function getCachedHighlight(key: string): string | undefined {
  return highlightCache.get(key);
}

function setCachedHighlight(key: string, html: string): void {
  if (highlightCache.size >= MAX_HIGHLIGHT_CACHE) {
    const oldest = highlightCache.keys().next().value;
    if (oldest !== undefined) highlightCache.delete(oldest);
  }
  highlightCache.set(key, html);
}

export async function highlightCode(
  code: string,
  lang: string,
  theme: string,
): Promise<string> {
  const cacheKey = getHighlightCacheKey(theme, lang, code);
  const cached = getCachedHighlight(cacheKey);
  if (cached) return cached;

  const highlighter = await getOrInitHighlighter();
  const loadedThemes = highlighter.getLoadedThemes();
  if (theme && !loadedThemes.includes(theme)) {
    try {
      await highlighter.loadTheme(theme as BundledTheme);
    } catch {
      // Fall back gracefully if theme cannot be loaded
    }
  }

  const targetLang = lang || "text";
  const loadedLangs = highlighter.getLoadedLanguages();
  if (targetLang !== "text" && !loadedLangs.includes(targetLang)) {
    try {
      await highlighter.loadLanguage(targetLang as BundledLanguage);
    } catch {
      // Fall back to plain text if unsupported
    }
  }

  const finalLang = highlighter.getLoadedLanguages().includes(targetLang)
    ? targetLang
    : "text";
  const finalTheme = highlighter.getLoadedThemes().includes(theme)
    ? theme
    : "github-dark";

  const html = highlighter.codeToHtml(code, {
    lang: finalLang,
    theme: finalTheme,
  });

  setCachedHighlight(cacheKey, html);
  return html;
}

/** Escape HTML for fallback rendering. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
