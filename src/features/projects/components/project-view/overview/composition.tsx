"use client";

/**
 * Composition — what this repository is made of.
 *
 * Fixes the defect that made the old "tech stack" widget unreadable: it received
 * `LanguageEntry[]`, which carries GitHub's real per-language colour hex, and
 * threw it away in favour of `var(--primary)` for every row, then faded opacity
 * by index. The result was a single blue bar with descending opacity — one
 * progress bar, not a language breakdown — on a card whose entire job was to
 * distinguish languages from each other.
 *
 * Colour is used here the way it is in the rest of the redesign: to encode
 * identity, not to decorate. GitHub's colours are the language's own, so the
 * segments are recognisable, and the fallbacks are deterministic rather than
 * indexed so two languages never silently share a hue.
 */

import { memo } from "react";
import type { LanguageEntry } from "@/db/schema";
import { formatBytes, formatCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/**
 * Fallback hue for a language GitHub reported without a colour.
 *
 * Hashed from the name so the same language is the same colour across projects
 * and across reloads. Deliberately achromatic: the `gv-*` tokens on this page
 * mean "ready", "ageing", "stale", so a hue borrowed from that vocabulary would
 * make an unnamed language read as a status indicator.
 */
function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(0 0% ${32 + (hash % 28)}%)`;
}

export function colorFor(entry: LanguageEntry): string {
  return entry.color || fallbackColor(entry.name);
}

interface CompositionProps {
  languages: LanguageEntry[];
  /** Files per language we actually hold, from the insights query. */
  fileCounts?: { language: string; files: number }[];
  className?: string;
}

function Composition({
  languages,
  fileCounts = [],
  className,
}: CompositionProps) {
  if (languages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <p className="text-sm font-medium">No language data</p>
        <p className="text-muted-foreground mt-1 max-w-56 text-xs">
          GitHub reported no language breakdown for this repository.
        </p>
      </div>
    );
  }

  const filesByLanguage = new Map(
    fileCounts.map((row) => [row.language, row.files]),
  );
  // Percentages are recomputed against the languages actually shown. The old
  // widget sliced to six rows *after* computing percentages over the full set, so
  // a ten-language repository drew a bar summing to 60% and left the rest blank
  // with nothing to explain the gap.
  const shown = languages.slice(0, 6);
  const shownBytes = shown.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const remainder = languages.length - shown.length;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="flex h-2 gap-px overflow-hidden rounded-full"
        role="img"
        aria-label={shown
          .map((entry) => `${entry.name} ${(entry.percentage ?? 0).toFixed(1)}%`)
          .join(", ")}
      >
        {shown.map((entry) => (
          <span
            key={entry.name}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${shownBytes > 0 ? ((entry.size || 0) / shownBytes) * 100 : 0}%`,
              backgroundColor: colorFor(entry),
            }}
            title={`${entry.name} — ${formatBytes(entry.size || 0)}`}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {shown.map((entry) => {
          const files = filesByLanguage.get(entry.name);
          return (
            <li key={entry.name} className="flex items-center gap-2 text-xs">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(entry) }}
                aria-hidden="true"
              />
              <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                {entry.name}
              </span>
              {files !== undefined && (
                <span className="text-muted-foreground tabular-nums">
                  {formatCount(files)} files
                </span>
              )}
              <span className="text-muted-foreground w-16 shrink-0 text-right tabular-nums">
                {formatBytes(entry.size || 0)}
              </span>
            </li>
          );
        })}
        {remainder > 0 && (
          <li className="text-muted-foreground text-[11px]">
            +{remainder} more{" "}
            {remainder === 1 ? "language" : "languages"} not shown
          </li>
        )}
      </ul>
    </div>
  );
}

export { Composition, fallbackColor };
export default memo(Composition);