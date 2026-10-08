/**
 * SUBMIT BUTTON — Primary Action with Keyboard Accelerator & Loading States
 */

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, GitPullRequest } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface SubmitButtonProps {
  isLoading: boolean;
  isValid: boolean;
  disabled?: boolean;
}

export function SubmitButton({ isLoading, isValid, disabled = false }: SubmitButtonProps) {
  const reduced = useReducedMotion();
  const isDisabled = disabled || isLoading || !isValid;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={isLoading}
      className={cn(
        "group relative flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl font-gv-mono text-sm font-semibold tracking-wide transition-all duration-200 select-none",
        !isDisabled
          ? "border-gv-amber/70 bg-gradient-to-r from-gv-amber via-amber-500 to-amber-600 text-gv-void shadow-[0_0_24px_rgba(232,163,61,0.25)] hover:shadow-[0_0_32px_rgba(232,163,61,0.4)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          : "border-white/6 bg-gv-graphite-2/40 text-gv-fog/40 cursor-not-allowed",
      )}
    >
      {/* Loading sweep animation */}
      {isLoading && (
        <>
          {!reduced && (
            <div
              aria-hidden
              className="gv-scanline-sweep absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            />
          )}
          <div
            aria-hidden
            className="bg-gv-amber absolute inset-x-0 bottom-0 h-0.5 opacity-90"
          />
        </>
      )}

      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-2.5">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-gv-amber" />
            <span className="font-gv-mono text-sm font-semibold text-gv-bone">
              Indexing…
            </span>
          </>
        ) : (
          <>
            <GitPullRequest className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:rotate-12" />
            <span>Index Repository</span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />

            {!isDisabled && (
              <kbd className="ml-1.5 rounded border border-black/20 bg-black/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-black/80">
                ⌘↵
              </kbd>
            )}
          </>
        )}
      </span>
    </button>
  );
}
