/**
 * =============================================================================
 * PRIMARY CTA — "Add Repository" (Brief § Signature Moment & §5.5)
 * =============================================================================
 *
 * Behavior:
 * - Idle: dark graphite fill (--ink-900), 1px amber border (--ember-500), warm off-white text.
 * - Hover: amber fill sweeps left-to-right (.gv-cta), text flips to --ink-950.
 * - Submitting: button plays a left-to-right scan-line sweep inside itself
 *   (like a progress bar reading a diff) instead of a generic spinner.
 * - Reduced motion: cut scan-line animation; render direct state text.
 */

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GitCommit } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface SubmitButtonProps {
  isLoading: boolean;
  isValid: boolean;
}

export function SubmitButton({ isLoading, isValid }: SubmitButtonProps) {
  const reduced = useReducedMotion();
  const idle = isValid && !isLoading;

  return (
    <button
      type="submit"
      disabled={isLoading || !isValid}
      aria-busy={isLoading}
      className={cn(
        "relative flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg border font-gv-mono text-sm font-semibold tracking-wide transition-all duration-200",
        idle
          ? "gv-cta border-gv-amber bg-gv-graphite text-gv-bone cursor-pointer shadow-sm hover:shadow"
          : "border-gv-hairline bg-gv-graphite text-gv-fog opacity-50 cursor-not-allowed",
      )}
    >
      {/* ─── Left-to-Right Scan-Line Sweep on Submit ────────────────────── */}
      {isLoading && (
        <>
          {!reduced && (
            <div
              aria-hidden
              className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-gv-amber/30 to-transparent gv-scanline-sweep"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 bg-gv-amber opacity-80"
          />
        </>
      )}

      {/* ─── Button Content ────────────────────────────────────────────────── */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <motion.span
              animate={reduced ? {} : { rotate: 360 }}
              transition={reduced ? {} : { duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <GitCommit className="h-4 w-4 text-gv-amber" />
            </motion.span>
            <span className="font-gv-mono text-sm font-semibold tracking-wider text-gv-bone">
              Resolving diff…
            </span>
          </>
        ) : (
          <>
            <GitCommit className="h-4 w-4 shrink-0 text-gv-amber" />
            <span>Add Repository</span>
          </>
        )}
      </span>
    </button>
  );
}
