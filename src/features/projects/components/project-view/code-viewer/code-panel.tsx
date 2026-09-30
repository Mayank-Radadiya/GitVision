"use client";

/**
 * Code Panel — Shiki-powered syntax highlighting with theme selector.
 *
 * Features:
 * - Server-grade Shiki syntax highlighting (same engine as VS Code)
 * - User-selectable themes (8 curated options)
 * - Line numbers
 * - Copy-to-clipboard button
 * - "Ask About This File" — opens a project chat seeded with this path
 * - File path breadcrumb
 * - Theme-aware: module-scope singleton cache keyed off resolved next-themes mode
 * - Zero flicker across file tree navigation with cached highlighter and HTML
 */

import { memo, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import type { Highlighter, BundledLanguage, BundledTheme } from "shiki";
import {
  Copy,
  Check,
  FileCode,
  ChevronDown,
  Palette,
  MessageSquare,
} from "lucide-react";
import { trpc } from "@/src/lib/trpc/client";
import { cn } from "@/shared/lib/utils";
import { CODE_THEMES, splitHighlightedLines, type ThemeOption } from "./utils";

// ─── Module-scope Shiki Highlighter & Theme Singletons ──────────────────────

const STORAGE_KEY_PREFIX = "gitvision:shiki-theme:";
const LEGACY_STORAGE_KEY = "gitvision-shiki-theme";

// Default fallback themes keyed by next-themes mode
const DEFAULT_THEMES: Record<"dark" | "light", string> = {
  dark: "github-dark",
  light: "github-light",
};

// Module-level memoized theme cache keyed off resolved next-themes value ("dark" | "light")
const themeCache = new Map<"dark" | "light", string>([
  ["dark", "github-dark"],
  ["light", "github-light"],
]);

// Initialize cached preferences from localStorage if available
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
    // Check legacy key as fallback
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const match = CODE_THEMES.find((t) => t.id === legacy);
      if (match) {
        themeCache.set(match.type, match.id);
      }
    }
  } catch {
    // Ignore storage errors in restricted contexts (e.g. incognito)
  }
}
initThemeCache();

/** Retrieve the resolved Shiki theme for a given next-themes mode */
function getResolvedShikiTheme(mode: "dark" | "light"): string {
  return themeCache.get(mode) ?? DEFAULT_THEMES[mode];
}

/** Persist explicit user theme choice across file switches and reloads */
function persistShikiTheme(themeId: string, currentMode: "dark" | "light"): void {
  const match = CODE_THEMES.find((t) => t.id === themeId);
  themeCache.set(currentMode, themeId);
  if (match) {
    themeCache.set(match.type, themeId);
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${currentMode}`, themeId);
      if (match) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${match.type}`, themeId);
      }
      localStorage.setItem(LEGACY_STORAGE_KEY, themeId);
    } catch {
      // Ignore storage errors
    }
  }
}

// ─── Module-scope Highlighter Singleton ─────────────────────────────────────

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

async function getOrInitHighlighter(): Promise<Highlighter> {
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

// Bounded LRU cache for highlighted HTML (theme::lang::content -> html)
const MAX_HIGHLIGHT_CACHE = 100;
const highlightCache = new Map<string, string>();

function getHighlightCacheKey(theme: string, lang: string, content: string): string {
  return `${theme}::${lang}::${content}`;
}

function getCachedHighlight(key: string): string | undefined {
  return highlightCache.get(key);
}

function setCachedHighlight(key: string, html: string): void {
  if (highlightCache.size >= MAX_HIGHLIGHT_CACHE) {
    const oldest = highlightCache.keys().next().value;
    if (oldest !== undefined) {
      highlightCache.delete(oldest);
    }
  }
  highlightCache.set(key, html);
}

async function highlightCode(
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

interface CodePanelProps {
  filePath: string;
  content: string;
  language: string;
  /** Owning project — lets "Ask About This File" open a project chat (F-09). */
  projectId: string;
  // 1-based line to scroll to and tint, from the viewer's ?line= deep link.
  highlightLine?: number;
}

function CodePanel({
  filePath,
  content = "",
  language,
  projectId,
  highlightLine,
}: CodePanelProps) {
  const { theme: systemTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  // Resolved mode: "dark" or "light", prioritizing resolvedTheme from next-themes
  const effectiveMode: "dark" | "light" =
    resolvedTheme === "light" || resolvedTheme === "dark"
      ? resolvedTheme
      : systemTheme === "dark"
        ? "dark"
        : "light";

  // F-09: open a fresh project chat pre-seeded with this file's path. The
  // seeded prompt matches the query classifier's file-specific pattern, so the
  // backend already routes it to the file context fetcher — no extra plumbing.
  const askMutation = trpc.chat.create.useMutation({
    onSuccess: (data) => {
      router.push(
        `/chat/${data.id}?file=${encodeURIComponent(filePath)}`,
      );
    },
  });

  // ─── Theme state — initialized from module cache keyed off resolved mode ─
  const [selectedTheme, setSelectedTheme] = useState<string>(() =>
    getResolvedShikiTheme(effectiveMode),
  );

  // Synchronous check if already in highlighted HTML cache
  const initialCacheKey = getHighlightCacheKey(
    selectedTheme,
    language || "text",
    content,
  );
  const [highlightedHtml, setHighlightedHtml] = useState<string>(
    () => getCachedHighlight(initialCacheKey) || "",
  );
  const [isHighlighting, setIsHighlighting] = useState<boolean>(() => {
    if (!content || getCachedHighlight(initialCacheKey)) return false;
    return highlighterSingleton === null;
  });

  const [copied, setCopied] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  // ─── Mode switch listener — only re-theme when next-themes mode flips ────
  const prevModeRef = useRef(effectiveMode);
  useEffect(() => {
    if (prevModeRef.current !== effectiveMode) {
      prevModeRef.current = effectiveMode;
      // Re-resolve to cached theme for the new mode without overwriting user selections
      setSelectedTheme(getResolvedShikiTheme(effectiveMode));
    }
  }, [effectiveMode]);

  // ─── Shiki highlighting — re-uses module singleton and highlight cache ───
  useEffect(() => {
    let cancelled = false;
    const cacheKey = getHighlightCacheKey(
      selectedTheme,
      language || "text",
      content,
    );
    const cached = getCachedHighlight(cacheKey);

    if (cached) {
      setHighlightedHtml(cached);
      setIsHighlighting(false);
      return;
    }

    // Only show shimmer skeleton on cold start if highlighter singleton is not ready
    if (highlighterSingleton === null) {
      setIsHighlighting(true);
    }

    async function highlight() {
      try {
        const html = await highlightCode(content, language, selectedTheme);
        if (!cancelled) {
          setHighlightedHtml(html);
          setIsHighlighting(false);
        }
      } catch {
        // Fallback: show raw code if Shiki fails for this language
        if (!cancelled) {
          setHighlightedHtml(
            `<pre class="shiki"><code>${escapeHtml(content)}</code></pre>`,
          );
          setIsHighlighting(false);
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [content, language, selectedTheme]);

  // ─── Virtualized lines ───────────────────────────────────────────────────
  // Shiki returns the whole file as one HTML blob. Split it once per
  // (content, highlight result) so the virtualizer only mounts the rows that
  // are actually on screen.
  const highlighted = useMemo(
    () => splitHighlightedLines(highlightedHtml, content),
    [highlightedHtml, content],
  );
  const virtualizer = useVirtualizer({
    count: highlighted.lines.length,
    getScrollElement: () => codeAreaRef.current,
    // Matches the row height below (text-[13px] + leading-6) so the estimate
    // never drifts from what is rendered.
    estimateSize: () => 24,
    overscan: 15,
  });
  const totalSize = virtualizer.getTotalSize();
  // The 1-based line the deep link is currently tinting, if any.
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // ─── Deep-link line targeting (?line=) ────────────────────────────────────
  // The target row may not be mounted yet (the virtualizer only renders the
  // visible window), so scrolling and tinting are separate passes: this one
  // tells the virtualizer where to go, the next one tints once the row exists.
  useEffect(() => {
    if (!highlightLine || isHighlighting) return;
    if (highlightLine > highlighted.lines.length) return;
    virtualizer.scrollToIndex(highlightLine - 1, { align: "center" });
    setHighlightedLine(highlightLine);
    // `totalSize` is what causes the rows to mount, so it has to be a dep.
  }, [highlighted.lines.length, highlightLine, isHighlighting, totalSize, virtualizer]);

  useEffect(() => {
    if (highlightedLine === null) return;
    const lineEl = codeAreaRef.current?.querySelector(
      `[data-line="${highlightedLine}"]`,
    );
    if (!(lineEl instanceof HTMLElement)) return;
    // bg-primary/10 is a literal elsewhere in the tree, so Tailwind emits it.
    lineEl.classList.add("bg-primary/10");
    return () => lineEl.classList.remove("bg-primary/10");
  }, [highlightedLine, totalSize]);

  // ─── Copy to clipboard ─────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  // ─── Explicit user theme selection ─────────────────────────────────────
  const handleSelectTheme = useCallback(
    (themeId: string) => {
      setSelectedTheme(themeId);
      persistShikiTheme(themeId, effectiveMode);
      setShowThemeMenu(false);
    },
    [effectiveMode],
  );

  // ─── Close theme menu on outside click ──────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Current theme info ─────────────────────────────────────────────────
  const currentTheme =
    CODE_THEMES.find((t) => t.id === selectedTheme) || CODE_THEMES[0];
  const fileName = filePath.split("/").pop() || filePath;

  // ─── Line count ─────────────────────────────────────────────────────────
  const lineCount = content.split("\n").length;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-border/60 bg-card flex items-center justify-between border-b px-4 py-2.5">
        {/* File path breadcrumb */}
        <div className="flex min-w-0 items-center gap-2">
          <FileCode className="text-primary h-4 w-4 shrink-0" />
          <span className="text-foreground truncate text-sm font-medium">
            {fileName}
          </span>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {filePath}
          </span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Line count badge */}
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {lineCount} lines
          </span>

          {/* Ask about this file */}
          <button
            onClick={() =>
              askMutation.mutate({ type: "project", projectId })
            }
            disabled={askMutation.isPending}
            aria-label={`Ask about ${fileName} in chat`}
            className={cn(
              "bg-background/50 hover:bg-accent/50 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              "border-border/40 text-muted-foreground hover:text-foreground",
              askMutation.isPending && "cursor-not-allowed opacity-60",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {askMutation.isPending ? "Opening…" : "Ask About This File"}
            </span>
          </button>

          {/* Theme selector */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="border-border/40 bg-background/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{currentTheme.label}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {/* Theme dropdown */}
            {showThemeMenu && (
              <div className="border-border/60 bg-popover/95 absolute top-full right-0 z-50 mt-1 min-w-50 rounded-lg border py-1 shadow-xl backdrop-blur-xl">
                <div className="text-muted-foreground/60 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Light
                </div>
                {CODE_THEMES.filter((t) => t.type === "light").map(
                  (t: ThemeOption) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTheme(t.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
                        selectedTheme === t.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/80 hover:bg-accent/50",
                      )}
                    >
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-white ring-1 ring-slate-300" />
                      {t.label}
                      {selectedTheme === t.id && (
                        <Check className="text-primary ml-auto h-3 w-3" />
                      )}
                    </button>
                  ),
                )}
                <div className="text-muted-foreground/60 border-border/40 mt-1 border-t px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Dark
                </div>
                {CODE_THEMES.filter((t) => t.type === "dark").map(
                  (t: ThemeOption) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTheme(t.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
                        selectedTheme === t.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/80 hover:bg-accent/50",
                      )}
                    >
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-700 ring-1 ring-slate-500" />
                      {t.label}
                      {selectedTheme === t.id && (
                        <Check className="text-primary ml-auto h-3 w-3" />
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            aria-label={copied ? "Code copied to clipboard" : "Copy file code"}
            className={cn(
              "bg-background/50 hover:bg-accent/50 flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              copied
                ? "border-emerald-500/30 text-emerald-500"
                : "border-border/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div ref={codeAreaRef} className="bg-muted/20 relative flex-1 overflow-auto">
        {isHighlighting ? (
          /* Shimmer loading while Shiki processes */
          <div className="space-y-2 p-4">
            {Array.from({ length: Math.min(lineCount, 20) }).map((_, i) => (
              <div
                key={i}
                className="flex gap-4"
                style={{ opacity: 1 - i * 0.04 }}
              >
                <div className="bg-muted/50 h-4 w-8 animate-pulse rounded" />
                <div
                  className="bg-muted/30 h-4 animate-pulse rounded"
                  style={{ width: `${30 + Math.random() * 50}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Virtualized Shiki output — only the visible window is mounted. */
          <div
            className="relative text-[13px]"
            style={highlighted.preStyle}
          >
            <div
              className="absolute top-0 left-0 w-full"
              style={{ height: totalSize }}
            >
              {virtualizer.getVirtualItems().map((item) => (
                <div
                  key={item.key}
                  data-line={item.index + 1}
                  className="line absolute top-0 left-0 flex w-full leading-6 select-none"
                  style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                >
                  <span
                    aria-hidden
                    className="text-muted-foreground/40 sticky left-0 w-8 shrink-0 pr-4 text-right tabular-nums"
                  >
                    {item.index + 1}
                  </span>
                  <span
                    className="min-w-0 flex-1 whitespace-pre"
                    dangerouslySetInnerHTML={{ __html: highlighted.lines[item.index] }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Escape HTML for fallback rendering */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default memo(CodePanel);
