/**
 * =============================================================================
 * SUBMIT BUTTON COMPONENT
 * =============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { getLoadingMessage } from "../add-repo.utils";

interface SubmitButtonProps {
  isLoading: boolean;
  isValid: boolean;
  currentStep: number;
}

export function SubmitButton({
  isLoading,
  isValid,
  currentStep,
}: SubmitButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.7 }}
    >
      <Button
        type="submit"
        disabled={isLoading || !isValid}
        className={cn(
          "h-12 w-full gap-2 rounded-xl font-semibold text-base",
          "bg-gradient-to-r from-primary to-violet-600",
          "shadow-lg shadow-primary/25",
          "hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]",
          "active:scale-[0.98]",
          "transition-all duration-300",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {getLoadingMessage(currentStep)}
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Add Repository
          </>
        )}
      </Button>
    </motion.div>
  );
}
