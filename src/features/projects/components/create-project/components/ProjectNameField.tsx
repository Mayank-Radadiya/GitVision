/**
 * =============================================================================
 * PROJECT NAME FIELD — Auto-naming Action & Clean Typography
 * =============================================================================
 */

"use client";

import { Field } from "./Field";
import type {
  UseFormRegister,
  FieldErrors,
  UseFormSetValue,
} from "react-hook-form";
import type { CreateProjectInput } from "../add-repo.constants";
import { extractRepoInfo } from "../add-repo.utils";
import { Wand2 } from "lucide-react";

interface ProjectNameFieldProps {
  register: UseFormRegister<CreateProjectInput>;
  setValue?: UseFormSetValue<CreateProjectInput>;
  errors: FieldErrors<CreateProjectInput>;
  value: string;
  repoUrl?: string;
  isLoading: boolean;
}

export function ProjectNameField({
  register,
  setValue,
  errors,
  value,
  repoUrl = "",
  isLoading,
}: ProjectNameFieldProps) {
  const hasError = !!errors.projectName;
  const extracted = extractRepoInfo(repoUrl);

  const handleAutoFill = () => {
    if (extracted && setValue) {
      // Format as "Owner / Repo" or "Repo Name"
      const name = `${extracted.repo.charAt(0).toUpperCase()}${extracted.repo.slice(1)}`;
      setValue("projectName", name, {
        shouldValidate: true,
        shouldTouch: true,
      });
    }
  };

  return (
    <Field
      id="projectName"
      label="Project Name"
      placeholder="e.g. React Core Framework"
      value={value}
      disabled={isLoading}
      ariaInvalid={hasError}
      registration={register("projectName")}
      actionButton={
        extracted && setValue ? (
          <button
            type="button"
            onClick={handleAutoFill}
            className="font-gv-mono text-gv-amber hover:text-gv-bone inline-flex cursor-pointer items-center gap-1 text-[10px] transition-colors"
            title="Auto-fill name from repository URL"
          >
            <Wand2 className="h-3 w-3" />
            <span>Auto-fill ({extracted.repo})</span>
          </button>
        ) : null
      }
      helper={
        hasError ? (
          <span className="font-gv-mono text-gv-ember text-xs">
            {errors.projectName?.message || "Project name is required"}
          </span>
        ) : (
          <span className="font-gv-mono text-gv-fog/80 text-xs">
            Internal label inside GitVision workspace.
          </span>
        )
      }
    />
  );
}
