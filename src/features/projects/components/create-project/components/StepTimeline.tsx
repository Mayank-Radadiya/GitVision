/**
 * =============================================================================
 * STEP TIMELINE — Commit Nodes on a Branch Stroke
 * =============================================================================
 */

"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StepTimelineProps {
  currentStep: number;
}

const STEPS = [
  { id: 1, label: "01 DETAILS", title: "Target Repo" },
  { id: 2, label: "02 VALIDATE", title: "Verify Remote" },
  { id: 3, label: "03 ANALYZE", title: "Deep Index" },
];

export function StepTimeline({ currentStep }: StepTimelineProps) {
  return (
    <div className="rounded-lg border border-gv-hairline/80 bg-gv-graphite-2/40 p-3.5">
      <ol className="flex items-center justify-between">
        {STEPS.map(({ id, label, title }, i) => {
          const isComplete = id < currentStep;
          const isActive = id === currentStep;

          return (
            <li key={label} className="relative flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  {isActive && (
                    <span
                      aria-hidden
                      className="gv-head-pulse absolute inset-0 rounded-full bg-gv-amber/50"
                    />
                  )}
                  <span
                    className={cn(
                      "relative flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-200",
                      isComplete
                        ? "border-gv-moss bg-gv-moss text-gv-void"
                        : isActive
                          ? "border-gv-amber bg-gv-amber text-gv-void shadow-[0_0_12px_rgba(232,163,61,0.4)]"
                          : "border-gv-hairline bg-gv-graphite-2 text-gv-fog/50",
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      id
                    )}
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-1.5 font-gv-mono text-[10px] font-semibold tracking-wider",
                    isActive
                      ? "text-gv-amber"
                      : isComplete
                        ? "text-gv-moss"
                        : "text-gv-fog/60",
                  )}
                >
                  {title}
                </span>
              </div>

              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 transition-colors duration-300",
                    id < currentStep ? "bg-gv-moss" : "bg-gv-hairline/60",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
