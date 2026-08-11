"use client";

/**
 * Tech Stack Widget — Language distribution with segmented progress bar.
 *
 * Data is mock for now (marked with TODO).
 * Ready to be replaced with a real API call (e.g., GitHub Languages API / tRPC).
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { Code2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Language {
  name: string;
  percentage: number;
  color: string;
}

// ─── Mock Data (TODO: replace with real API data) ────────────────────────────

const MOCK_LANGUAGES: Language[] = [
  { name: "TypeScript", percentage: 60, color: "#3178C6" },
  { name: "JavaScript", percentage: 28, color: "#F7DF1E" },
  { name: "Python", percentage: 8, color: "#3776AB" },
  { name: "CSS", percentage: 4, color: "#663399" },
];

// ─── Component ───────────────────────────────────────────────────────────────

function TechStackWidget() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
          <Code2 className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-foreground text-sm leading-none font-semibold">
            Tech Stack
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            Language distribution
          </p>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="mb-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {MOCK_LANGUAGES.map((lang, i) => (
          <motion.div
            key={lang.name}
            initial={{ scaleX: 0, transformOrigin: "left" }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              width: `${lang.percentage}%`,
              backgroundColor: lang.color,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2.5">
        {MOCK_LANGUAGES.map((lang, i) => (
          <motion.div
            key={lang.name}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: lang.color }}
              />
              <span className="text-foreground/80 text-xs font-medium">
                {lang.name}
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {lang.percentage}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default memo(TechStackWidget);
