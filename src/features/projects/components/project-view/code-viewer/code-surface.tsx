"use client";

/**
 * Code Surface — the reading area.
 *
 * Everything above this component (command bar, tab strip) exists to serve the
 * code, so this file owns exactly two jobs: turn the file into highlighted
 * lines, and window them so a 5,000-line module costs the same to render as a
 * 50-line one.
 *
 * Split out of the old `code-panel.tsx`, which had grown to hold the
 * breadcrumb, the facts row, the theme menu, the copy handler, the Shiki
 * pipeline, and the virtualizer. Those are five responsibilities; the code
 * surface keeps the two that are actually about code.
 *
 * Two behaviours are load-bearing and easy to lose in a refactor:
 *
 *   - **The `?line=` deep link targets a row the virtualizer may not have
 *     mounted.** Scrolling and tinting are therefore two passes: tell the
 *     virtualizer where to go, then tint once the row exists.
 *   - **A cold highlighter shimmers; a warm one never does.** The shimmer is
 *     gated on `isHighlighterReady()`, not on the absence of HTML, so
 *     navigating between cached files is instant.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/shared/lib/utils";
import {
  escapeHtml,
  getCachedHighlight,
  getHighlightCacheKey,
  highlightCode,
  isHighlighterReady,
} from "./highlight";
import { splitHighlightedLines } from "./utils";

interface CodeSurfaceProps {
  content: string;
  language: string;
  /** Active Shiki theme id. */
  theme: string;
  /** 1-based line to scroll to and tint, from the viewer's `?line=` deep link. */
  highlightLine?: number;
  /** Line count of the file, used to size the loading shimmer honestly. */
  lineCount: number;
  className?: string;
}

/** Row height in px — must match the rendered `leading-6` + 13px text. */
const ROW_ESTIMATE = 24;
const OVERSCAN = 15;

function CodeSurface({
  content,
  language,
  theme,
  highlightLine,
  lineCount,
  className,
}: CodeSurfaceProps) {
  const codeAreaRef = useRef<HTMLDivElement>(null);

  const initialCacheKey = getHighlightCacheKey(
    theme,
    language || "text",
    content,
  );
  const [highlightedHtml, setHighlightedHtml] = useState<string>(
    () => getCachedHighlight(initialCacheKey) || "",
  );
  const [isHighlighting, setIsHighlighting] = useState<boolean>(() => {
    if (!content || getCachedHighlight(initialCacheKey)) return false;
    return !isHighlighterReady();
  });

  useEffect(() => {
    let cancelled = false;
    const cacheKey = getHighlightCacheKey(theme, language || "text", content);
    const cached = getCachedHighlight(cacheKey);

    if (cached) {
      setHighlightedHtml(cached);
      setIsHighlighting(false);
      return;
    }

    // Only show the shimmer when the highlighter itself is still warming up.
    if (!isHighlighterReady()) setIsHighlighting(true);

    async function highlight() {
      try {
        const html = await highlightCode(content, language, theme);
        if (!cancelled) {
          setHighlightedHtml(html);
          setIsHighlighting(false);
        }
      } catch {
        // Fallback: show raw code if Shiki fails for this language.
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
  }, [content, language, theme]);

  const highlighted = useMemo(
    () => splitHighlightedLines(highlightedHtml, content),
    [highlightedHtml, content],
  );

  const virtualizer = useVirtualizer({
    count: highlighted.lines.length,
    getScrollElement: () => codeAreaRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: OVERSCAN,
  });
  const totalSize = virtualizer.getTotalSize();
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // ─── Deep-link line targeting (?line=) ───────────────────────────────────
  useEffect(() => {
    if (!highlightLine || isHighlighting) return;
    if (highlightLine > highlighted.lines.length) return;
    virtualizer.scrollToIndex(highlightLine - 1, { align: "center" });
    setHighlightedLine(highlightLine);
    // `totalSize` is what causes the rows to mount, so it has to be a dep.
  }, [
    highlighted.lines.length,
    highlightLine,
    isHighlighting,
    totalSize,
    virtualizer,
  ]);

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

  if (isHighlighting) {
    return (
      <div
        role="status"
        className={cn("bg-muted/20 space-y-2 p-4", className)}
      >
        <span className="sr-only">Highlighting {lineCount} lines…</span>
        {Array.from({ length: Math.min(lineCount, 20) }).map((_, index) => (
          <div
            key={index}
            className="flex gap-4"
            style={{ opacity: 1 - index * 0.04 }}
          >
            <div className="bg-muted/50 h-4 w-8 animate-pulse rounded" />
            <div
              className="bg-muted/30 h-4 animate-pulse rounded"
              style={{ width: `${30 + ((index * 37) % 50)}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={codeAreaRef}
      className={cn("bg-muted/20 relative flex-1 overflow-auto", className)}
    >
      <div className="relative text-[13px]" style={highlighted.preStyle}>
        <div
          className="absolute top-0 left-0 w-full"
          style={{ height: totalSize }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              data-line={item.index + 1}
              className="line absolute top-0 left-0 flex w-full leading-6 select-none"
              style={{
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <span
                aria-hidden
                className="text-muted-foreground/40 sticky left-0 w-12 shrink-0 pr-4 text-right tabular-nums"
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
    </div>
  );
}

export default memo(CodeSurface);
