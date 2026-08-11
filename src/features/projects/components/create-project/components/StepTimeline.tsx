/**
 * =============================================================================
 * STEP TIMELINE — Commit Nodes on a Branch Stroke (Brief § Typography & §5.2)
 * =============================================================================
 *
 * Completed node: filled --diff-add-500 + check.
 * Active node: filled --ember-500 with soft outer HEAD pulse.
 * Upcoming node: hollow hairline stroke at 40% opacity.
 * Step labels: IBM Plex Mono, uppercase, tracked out.
 */

"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StepTimelineProps {
  currentStep: number;
}

const LABELS = ["01 DETAILS", "02 VALIDATION", "03 ANALYSIS"];

export function StepTimeline({ currentStep }: StepTimelineProps) {
  return (
    <ol className="flex items-start">
      {LABELS.map((label, i) => {
        const id = i + 1;
        const isComplete = id < currentStep;
        const isActive = id === currentStep;

        const leftTraversed = id <= currentStep;
        const rightTraversed = isComplete;

        return (
          <li
            key={label}
            className={cn("flex flex-col items-center", i === 0 && "flex-1", i > 0 && "flex-1")}
          >
            {/* Branch stroke + commit node */}
            <div className="flex h-4 w-full items-center">
              <span
                className={cn(
                  "h-px flex-1 transition-colors duration-300",
                  i === 0 ? "invisible" : leftTraversed ? "bg-gv-moss" : "bg-gv-hairline",
                )}
              />
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                {isActive && (
                  <span
                    aria-hidden
                    className="gv-head-pulse absolute inset-0 rounded-full bg-gv-amber"
                  />
                )}
                <span
                  className={cn(
                    "relative flex h-4 w-4 items-center justify-center rounded-full border transition-colors duration-300",
                    isComplete
                      ? "border-gv-moss bg-gv-moss text-gv-void"
                      : isActive
                        ? "border-gv-amber bg-gv-amber text-gv-void"
                        : "border-gv-hairline bg-transparent opacity-40",
                  )}
                >
                  {isComplete && (
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "h-px flex-1 transition-colors duration-300",
                  i === LABELS.length - 1
                    ? "invisible"
                    : rightTraversed
                      ? "bg-gv-moss"
                      : "bg-gv-hairline",
                )}
              />
            </div>
            <span
              className={cn(
                "mt-2.5 whitespace-nowrap font-gv-mono text-[10px] font-semibold tracking-[0.2em]",
                isActive
                  ? "text-gv-amber"
                  : isComplete
                    ? "text-gv-moss"
                    : "text-gv-fog/60",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
