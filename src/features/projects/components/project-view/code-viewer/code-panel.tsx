"use client";

/**
 * Code Panel — Shiki-powered syntax highlighting with theme selector.
 *
 * Features:
 * - Server-grade Shiki syntax highlighting (same engine as VS Code)
 * - User-selectable themes (8 curated options)
 * - Line numbers
 * - Copy-to-clipboard button
 * - File path breadcrumb
 * - Theme-aware: defaults based on system dark/light mode
 * - Memoized highlighting to prevent re-renders
 */

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { Copy, Check, FileCode, ChevronDown, Palette } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { CODE_THEMES, type ThemeOption } from "./utils";

interface CodePanelProps {
  filePath: string;
  content: string;
  language: string;
}

function CodePanel({ filePath, content = "", language }: CodePanelProps) {
  const { theme: systemTheme } = useTheme();
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ─── Theme state — default based on system theme ────────────────────────
  const defaultTheme = systemTheme === "dark" ? "github-dark" : "github-light";
  const [selectedTheme, setSelectedTheme] = useState(defaultTheme);

  // Update default when system theme changes
  useEffect(() => {
    const newDefault = systemTheme === "dark" ? "github-dark" : "github-light";
    setSelectedTheme(newDefault);
  }, [systemTheme]);

  // ─── Shiki highlighting — lazy loaded ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsHighlighting(true);

    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki");
        const html = await codeToHtml(content, {
          lang: language || "text",
          theme: selectedTheme as Parameters<typeof codeToHtml>[1] extends {
            theme: infer T;
          }
            ? T
            : string,
        });

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

  // ─── Copy to clipboard ─────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-card px-4 py-2.5">
        {/* File path breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {filePath}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Line count badge */}
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {lineCount} lines
          </span>

          {/* Theme selector */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                "border border-border/40 bg-background/50",
                "hover:bg-accent/50 transition-colors cursor-pointer",
                "text-muted-foreground hover:text-foreground",
              )}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{currentTheme.label}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {/* Theme dropdown */}
            {showThemeMenu && (
              <div
                className={cn(
                  "absolute right-0 top-full mt-1 z-50",
                  "min-w-[200px] rounded-lg border border-border/60",
                  "bg-popover/95 backdrop-blur-xl shadow-xl",
                  "py-1",
                )}
              >
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Light
                </div>
                {CODE_THEMES.filter((t) => t.type === "light").map(
                  (t: ThemeOption) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-xs",
                        "transition-colors cursor-pointer",
                        selectedTheme === t.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/80 hover:bg-accent/50",
                      )}
                    >
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-white ring-1 ring-slate-300" />
                      {t.label}
                      {selectedTheme === t.id && (
                        <Check className="h-3 w-3 ml-auto text-primary" />
                      )}
                    </button>
                  ),
                )}
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-t border-border/40 mt-1">
                  Dark
                </div>
                {CODE_THEMES.filter((t) => t.type === "dark").map(
                  (t: ThemeOption) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-xs",
                        "transition-colors cursor-pointer",
                        selectedTheme === t.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/80 hover:bg-accent/50",
                      )}
                    >
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-slate-700 ring-1 ring-slate-500" />
                      {t.label}
                      {selectedTheme === t.id && (
                        <Check className="h-3 w-3 ml-auto text-primary" />
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
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
              "border border-border/40 bg-background/50",
              "hover:bg-accent/50 transition-colors cursor-pointer",
              copied
                ? "text-emerald-500 border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground",
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
      <div className="flex-1 overflow-auto relative bg-muted/20">
        {isHighlighting ? (
          /* Shimmer loading while Shiki processes */
          <div className="p-4 space-y-2">
            {Array.from({ length: Math.min(lineCount, 20) }).map((_, i) => (
              <div
                key={i}
                className="flex gap-4"
                style={{ opacity: 1 - i * 0.04 }}
              >
                <div className="w-8 h-4 rounded bg-muted/50 animate-pulse" />
                <div
                  className="h-4 rounded bg-muted/30 animate-pulse"
                  style={{ width: `${30 + Math.random() * 50}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Shiki output */
          <div
            className={cn(
              "shiki-container text-sm min-h-full",
              "[&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:min-h-full [&_pre]:rounded-none",
              "[&_code]:text-[13px] [&_code]:leading-6",
              "[&_.line]:before:content-[counter(line)] [&_.line]:before:counter-increment-[line]",
              "[&_.line]:before:inline-block [&_.line]:before:w-8 [&_.line]:before:mr-4",
              "[&_.line]:before:text-right [&_.line]:before:text-muted-foreground/40",
              "[&_.line]:before:select-none",
            )}
            style={{ counterReset: "line" } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
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
