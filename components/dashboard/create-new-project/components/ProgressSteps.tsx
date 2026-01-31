/**
 * =============================================================================
 * PROGRESS STEPS COMPONENT
 * =============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORM_STEPS, STEP_COLORS } from "../add-repo.constants";

interface ProgressStepsProps {
  currentStep: number;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {FORM_STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300",
                  currentStep > step.id
                    ? STEP_COLORS.completed
                    : currentStep === step.id
                      ? STEP_COLORS.active
                      : STEP_COLORS.inactive,
                )}
              >
                {currentStep > step.id ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </motion.div>
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-xs font-medium transition-colors",
                    currentStep >= step.id
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {step.description}
                </p>
              </div>
            </div>
            {index < FORM_STEPS.length - 1 && (
              <div className="mx-1 h-0.5 w-24 lg:w-44 mb-8">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    currentStep > step.id
                      ? "bg-gradient-to-r from-emerald-500 to-primary"
                      : "bg-muted",
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
