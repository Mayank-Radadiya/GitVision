/**
 * =============================================================================
 * STEP TIMELINE — Commit Nodes on a Hairline Rule
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
    <div>
      <ol className="flex items-center">
        {STEPS.map(({ id, title }, i) => {
          const isComplete = id < currentStep;
          const isActive = id === currentStep;

          return (
            <li key={title} className="relative flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold transition-colors duration-300",
                    isComplete
                      ? "border-gv-moss bg-gv-moss text-gv-void"
                      : isActive
                        ? "border-gv-amber bg-gv-amber text-gv-void shadow-[0_0_0_4px_rgba(232,163,61,0.15),0_0_14px_rgba(232,163,61,0.35)]"
                        : "border-gv-hairline bg-gv-graphite-2 text-gv-fog/50",
                  )}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    id
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 font-gv-mono text-[10px] font-semibold tracking-wider",
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

              {/* Connecting hairline */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-3 h-px flex-1 transition-colors duration-300",
                    id < currentStep ? "bg-gv-moss/60" : "bg-gv-hairline/60",
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