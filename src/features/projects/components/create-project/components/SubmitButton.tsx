/**
 * =============================================================================
 * PRIMARY CTA — "Connect & Add Repository"
 * =============================================================================
 */

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GitCommit, ArrowRight } from "lucide-react";
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
        "group relative flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border font-gv-mono text-sm font-bold tracking-wider transition-all duration-200",
        idle
          ? "gv-cta cursor-pointer border-gv-amber/80 bg-gv-graphite text-gv-bone shadow-[0_0_20px_rgba(232,163,61,0.15)] hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(232,163,61,0.3)] active:translate-y-0"
          : "cursor-not-allowed border-white/[0.06] bg-gv-graphite-2/40 text-gv-fog/50",
      )}
    >
      {/* Scan-line sweep during loading */}
      {isLoading && (
        <>
          {!reduced && (
            <div
              aria-hidden
              className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-gv-amber/40 to-transparent gv-scanline-sweep"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 bg-gv-amber opacity-90"
          />
        </>
      )}

      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-2.5">
        {isLoading ? (
          <>
            <motion.span
              animate={reduced ? {} : { rotate: 360 }}
              transition={reduced ? {} : { duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <GitCommit className="h-4 w-4 text-gv-amber" />
            </motion.span>
            <span className="font-gv-mono text-sm font-semibold tracking-wider text-gv-bone">
              Analyzing repository tree…
            </span>
          </>
        ) : (
          <>
            <GitCommit className="h-4 w-4 shrink-0 text-gv-amber transition-colors duration-200 group-hover:text-gv-void" />
            <span>Connect & Add Repository</span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-all duration-200 group-hover:translate-x-1 group-hover:text-gv-void" />
            {idle && (
              <kbd className="ml-1 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gv-bone/90 group-hover:border-gv-void/30 group-hover:bg-gv-void/20 group-hover:text-gv-void">
                ⌘↵
              </kbd>
            )}
          </>
        )}
      </span>
    </button>
  );
}