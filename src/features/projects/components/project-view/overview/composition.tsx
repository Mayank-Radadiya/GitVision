"use client";

import { memo, useState } from "react";
import type { LanguageEntry } from "@/db/schema";
import { formatBytes, formatCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(0 0% ${32 + (hash % 28)}%)`;
}

export function colorFor(entry: LanguageEntry): string {
  return entry.color || fallbackColor(entry.name);
}

interface CompositionProps {
  languages: LanguageEntry[];
  fileCounts?: { language: string; files: number }[];
  className?: string;
}

function Composition({
  languages,
  fileCounts = [],
  className,
}: CompositionProps) {
  const [expanded, setExpanded] = useState(false);
  if (languages.length === 0)
    return (
      <div className="py-3">
        <p className="text-xs font-medium">No language data yet</p>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          A source breakdown will appear when GitHub reports languages for this
          repository.
        </p>
      </div>
    );

  const sorted = [...languages].sort((a, b) => b.size - a.size);
  const totalBytes = sorted.reduce(
    (sum, entry) => sum + Math.max(entry.size || 0, 0),
    0,
  );
  const share = (entry: LanguageEntry) =>
    totalBytes > 0 ? (Math.max(entry.size || 0, 0) / totalBytes) * 100 : 0;
  const shown = expanded ? sorted : sorted.slice(0, 5);
  const remainderBytes = sorted
    .slice(5)
    .reduce((sum, entry) => sum + Math.max(entry.size || 0, 0), 0);
  const filesByLanguage = new Map(
    fileCounts.map((row) => [row.language, row.files]),
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="flex h-2 gap-px overflow-hidden rounded-sm"
        role="img"
        aria-label={`Language share by source bytes: ${sorted.map((entry) => `${entry.name} ${share(entry).toFixed(1)}%`).join(", ")}`}
      >
        {sorted.slice(0, 5).map((entry) => (
          <span
            key={entry.name}
            className="h-full transition-opacity hover:opacity-70"
            style={{
              width: `${share(entry)}%`,
              backgroundColor: colorFor(entry),
            }}
            title={`${entry.name}: ${share(entry).toFixed(1)}% · ${formatBytes(entry.size)}`}
          />
        ))}
        {remainderBytes > 0 && (
          <span
            className="bg-muted-foreground/40 h-full"
            style={{
              width: `${totalBytes > 0 ? (remainderBytes / totalBytes) * 100 : 0}%`,
            }}
            title={`${sorted.length - 5} other languages`}
          />
        )}
      </div>
      <ul className="space-y-2.5">
        {shown.map((entry) => (
          <li
            key={entry.name}
            className="flex items-center gap-2 text-[11px]"
            title={`${formatBytes(entry.size)}${filesByLanguage.has(entry.name) ? ` · ${formatCount(filesByLanguage.get(entry.name)!)} stored files` : ""}`}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(entry) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {entry.name}
            </span>
            {filesByLanguage.has(entry.name) && (
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {formatCount(filesByLanguage.get(entry.name)!)} files
              </span>
            )}
            <span className="text-muted-foreground w-12 shrink-0 text-right font-mono text-[10px] tabular-nums">
              {share(entry).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
        >
          {expanded
            ? "Show fewer languages"
            : `+ ${sorted.length - 5} more languages`}
        </button>
      )}
      <p className="text-muted-foreground border-border border-t pt-3 text-[10px]">
        {formatBytes(totalBytes)} of source · share by bytes, from GitHub
      </p>
    </div>
  );
}

export { Composition, fallbackColor };
export default memo(Composition);
