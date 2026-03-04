"use client";

/**
 * Global Language Breakdown — stacked bar showing the user's
 * dominant tech stack across all tracked repositories.
 */

import { memo, useMemo } from "react";
import { Code2 } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useLanguageBreakdown } from "@/features/dashboard/hooks/use-dashboard";

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3B82F6", // Blue
  TSX: "#A855F7", // Purple — distinct from TS
  JavaScript: "#FACC15", // Yellow
  JSX: "#F97316", // Orange — distinct from JS
  Python: "#22C55E", // Green
  Go: "#06B6D4", // Cyan
  Rust: "#F97316", // Orange
  Java: "#EF4444", // Red
  Ruby: "#DC2626", // Deep red
  CSS: "#818CF8", // Indigo
  SCSS: "#EC4899", // Pink
  HTML: "#F97316", // Orange
  JSON: "#FB7185", // Rose
  Markdown: "#14B8A6", // Teal — very distinct
  Shell: "#4ADE80", // Light green
  SQL: "#F59E0B", // Amber
  YAML: "#EF4444", // Red
  TOML: "#D97706", // Dark amber
  "C++": "#60A5FA", // Light blue
  C: "#9CA3AF", // Gray
  "C#": "#22C55E", // Green
  PHP: "#A78BFA", // Violet
  Swift: "#F43F5E", // Rose
  Kotlin: "#A855F7", // Purple
  Dart: "#0EA5E9", // Sky blue
  Vue: "#34D399", // Emerald
  Svelte: "#F97316", // Orange
  SVG: "#FCD34D", // Light yellow
  MJS: "#FBBF24", // Amber — for .mjs files
  CJS: "#D97706", // Dark amber — for .cjs files
  Config: "#9CA3AF", // Gray — for config files
};

const FALLBACK_COLOR = "#6B7280";

/** Horizontal stacked bar */
function StackedBar({
  data,
}: {
  data: { name: string; color: string | null; percentage: number }[];
}) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-primary/20">
      {data.map((entry) => (
        <div
          key={entry.name}
          className="transition-all duration-500 hover:opacity-80"
          style={{
            width: `${entry.percentage}%`,
            backgroundColor:
              entry.color || LANG_COLORS[entry.name] || FALLBACK_COLOR,
            minWidth: entry.percentage > 0 ? "3px" : "0",
          }}
          title={`${entry.name}: ${entry.percentage}%`}
        />
      ))}
    </div>
  );
}

function LegendItem({
  name,
  percentage,
  color,
}: {
  name: string;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-muted-foreground">
        {name}{" "}
        <span className="tabular-nums text-foreground/70">{percentage}%</span>
      </span>
    </div>
  );
}

function LanguageBreakdown() {
  const { data, isLoading } = useLanguageBreakdown();

  const topLangs = useMemo(() => (data || []).slice(0, 6), [data]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-5 backdrop-blur-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Code2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Tech Stack</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
        </div>
      ) : !topLangs || topLangs.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground/60">
          No files tracked yet
        </p>
      ) : (
        <div className="space-y-3">
          <StackedBar data={topLangs} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {topLangs.map((entry) => (
              <LegendItem
                key={entry.name}
                name={entry.name}
                percentage={entry.percentage}
                color={entry.color || LANG_COLORS[entry.name] || FALLBACK_COLOR}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(LanguageBreakdown);
