"use client";

/**
 * Tech Stack Widget — Language distribution with segmented progress bar.
 *
 * Renders the real per-project language breakdown stored on the project row
 * (`projects.languages` JSONB, populated from the GitHub Languages API during
 * sync). This widget previously rendered a hardcoded `MOCK_LANGUAGES` array, so
 * every project's Overview page showed a fabricated TypeScript/JavaScript/Python
 * split regardless of what the repository actually contained.
 */

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Code2 } from "lucide-react";
import type { LanguageEntry } from "@/db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Language {
  name: string;
  percentage: number;
  color: string;
}

/** Shown when GitHub reported no language data for this repository. */
const FALLBACK_COLOR = "var(--primary)";

const MAX_LEGEND_ROWS = 6;

/**
 * Convert GitHub's byte sizes into display percentages, largest first.
 * `color` is nullable in the schema, so fall back per-entry rather than
 * dropping the language entirely.
 */
function toLanguages(entries: LanguageEntry[]): Language[] {
  const withBytes = entries.filter((entry) => entry.size > 0);
  if (withBytes.length === 0) return [];

  const total = withBytes.reduce((sum, entry) => sum + entry.size, 0);
  if (total === 0) return [];

  return withBytes
    .map((entry) => ({
      name: entry.name,
      percentage: (entry.size / total) * 100,
      color: FALLBACK_COLOR,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, MAX_LEGEND_ROWS);
}

// ─── Component ───────────────────────────────────────────────────────────────

function TechStackWidget({ languages }: { languages: LanguageEntry[] }) {
  const displayLanguages = useMemo(() => toLanguages(languages), [languages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
          <Code2 className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-foreground text-sm leading-none font-semibold">
            Tech Stack
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Language distribution
          </p>
        </div>
      </div>

      {displayLanguages.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No language data reported for this repository.
        </p>
      ) : (
        <>
          {/* Segmented progress bar */}
          <div className="mb-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
            {displayLanguages.map((lang, i) => (
              <motion.div
                key={lang.name}
                initial={{ scaleX: 0, transformOrigin: "left" }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.2, delay: i * 0.1, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{
                  width: `${lang.percentage}%`,
                  backgroundColor: lang.color,
                  opacity: 1 - i / (MAX_LEGEND_ROWS + 1),
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2.5">
            {displayLanguages.map((lang, i) => (
              <motion.div
                key={lang.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.3 + i * 0.06 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: lang.color,
                      opacity: 1 - i / (MAX_LEGEND_ROWS + 1),
                    }}
                  />
                  <span className="text-foreground/80 text-xs font-medium">
                    {lang.name}
                  </span>
                </div>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {lang.percentage.toFixed(1)}%
                </span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(TechStackWidget);
