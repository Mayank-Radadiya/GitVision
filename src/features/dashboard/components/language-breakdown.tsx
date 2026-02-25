"use client";

/**
 * Global Language Breakdown — CSS-only donut chart showing the user's
 * dominant tech stack across all tracked repositories.
 */

import { memo, useMemo } from "react";
import { Code2 } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useLanguageBreakdown } from "@/features/dashboard/hooks/use-dashboard";

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  TSX: "#3178C6",
  JavaScript: "#F7DF1E",
  JSX: "#F7DF1E",
  Python: "#3776AB",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Java: "#ED8B00",
  Ruby: "#CC342D",
  CSS: "#264DE4",
  SCSS: "#CF649A",
  HTML: "#E34F26",
  JSON: "#5B5B5B",
  Markdown: "#083FA1",
  Shell: "#89E051",
  SQL: "#E38C00",
  YAML: "#CB171E",
  TOML: "#9C4121",
  "C++": "#00599C",
  C: "#555555",
  "C#": "#239120",
  PHP: "#777BB4",
  Swift: "#F05138",
  Kotlin: "#7F52FF",
  Dart: "#0175C2",
  Vue: "#42B883",
  Svelte: "#FF3E00",
  SVG: "#FFB13B",
};

const FALLBACK_COLOR = "#6B7280";

function DonutChart({
  data,
}: {
  data: { language: string; percentage: number }[];
}) {
  const segments = useMemo(() => {
    let offset = 0;
    return data.map((entry) => {
      const seg = {
        ...entry,
        offset,
        color: LANG_COLORS[entry.language] || FALLBACK_COLOR,
      };
      offset += entry.percentage;
      return seg;
    });
  }, [data]);

  const totalPercent = segments.reduce((s, e) => s + e.percentage, 0);

  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        {/* Background circle */}
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-muted/30"
        />
        {/* Segments */}
        {segments.map((seg) => (
          <circle
            key={seg.language}
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={seg.color}
            strokeWidth="3.5"
            strokeDasharray={`${seg.percentage} ${100 - seg.percentage}`}
            strokeDashoffset={`${100 - seg.offset}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        ))}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">
          {Math.round(totalPercent)}%
        </span>
        <span className="text-[9px] text-muted-foreground">tracked</span>
      </div>
    </div>
  );
}

function LegendItem({
  language,
  percentage,
  count,
  color,
}: {
  language: string;
  percentage: number;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
        {language}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {percentage}%
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground/50">
        ({count})
      </span>
    </div>
  );
}

function LanguageBreakdown() {
  const { data, isLoading } = useLanguageBreakdown();

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl",
        "shadow-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Code2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Tech Stack</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="mx-auto h-28 w-28 rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          No files tracked yet
        </p>
      ) : (
        <div className="space-y-4">
          <DonutChart data={data} />
          <div>
            {data.map((entry) => (
              <LegendItem
                key={entry.ext}
                language={entry.language}
                percentage={entry.percentage}
                count={entry.count}
                color={LANG_COLORS[entry.language] || FALLBACK_COLOR}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(LanguageBreakdown);
