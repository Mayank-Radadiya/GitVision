/**
 * =============================================================================
 * REPOSITORY URL FIELD COMPONENT
 * =============================================================================
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Github, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FormData, RepoInfo } from "../add-repo.constants";

interface RepositoryUrlFieldProps {
  register: UseFormRegister<FormData>;
  errors: FieldErrors<FormData>;
  isDirty: boolean;
  isLoading: boolean;
  repoPreview: RepoInfo | null;
}

export function RepositoryUrlField({
  register,
  errors,
  isDirty,
  isLoading,
  repoPreview,
}: RepositoryUrlFieldProps) {
  const hasError = !!errors.repoUrl;
  const isValid = isDirty && !hasError;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.6 }}
      className="space-y-2"
    >
      <Label
        htmlFor="repoUrl"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Github className="h-4 w-4 text-muted-foreground" />
        GitHub Repository URL
      </Label>
      <div className="relative">
        <Input
          id="repoUrl"
          type="url"
          {...register("repoUrl")}
          placeholder="https://github.com/username/repository"
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
        {errors.repoUrl?.message && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-1.5 text-xs text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.repoUrl.message}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Repository Preview */}
      <AnimatePresence>
        {repoPreview && !hasError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Github className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {repoPreview.owner}/{repoPreview.repo}
                </p>
                <p className="text-xs text-muted-foreground">
                  Repository detected
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
