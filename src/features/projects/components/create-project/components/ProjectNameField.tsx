/**
 * Project Name Field — Validated input with animated feedback.
 * Shows green checkmark when valid, red error text when invalid.
 * Uses Framer Motion AnimatePresence for smooth state transitions.
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FolderGit, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { CreateProjectInput } from "../add-repo.constants";

interface ProjectNameFieldProps {
  register: UseFormRegister<CreateProjectInput>;
  errors: FieldErrors<CreateProjectInput>;
  isDirty: boolean;
  isLoading: boolean;
}

export function ProjectNameField({
  register,
  errors,
  isDirty,
  isLoading,
}: ProjectNameFieldProps) {
  const hasError = !!errors.projectName;
  const isValid = isDirty && !hasError;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="space-y-2"
    >
      <Label
        htmlFor="projectName"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <FolderGit className="h-4 w-4 text-muted-foreground" />
        Project Name
      </Label>
      <div className="relative">
        <Input
          id="projectName"
          type="text"
          {...register("projectName")}
          placeholder="e.g., my-awesome-project"
          className={cn(
            "h-12 pl-4 pr-10",
            "bg-background/50 backdrop-blur-sm",
            "border-border/60 hover:border-primary/50 focus:border-primary",
            "transition-all duration-200",
            "placeholder:text-muted-foreground/50",
            hasError && "border-destructive focus:border-destructive",
            isValid && "border-emerald-500/50 focus:border-emerald-500",
          )}
          disabled={isLoading}
        />
        <AnimatePresence>
          {isValid && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        {errors.projectName?.message && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-1.5 text-xs text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.projectName.message}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
