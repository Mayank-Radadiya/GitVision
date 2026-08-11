/**
 * =============================================================================
 * PROJECT NAME FIELD
 * =============================================================================
 */

"use client";

import { Field } from "./Field";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { CreateProjectInput } from "../add-repo.constants";

interface ProjectNameFieldProps {
  register: UseFormRegister<CreateProjectInput>;
  errors: FieldErrors<CreateProjectInput>;
  value: string;
  isLoading: boolean;
}

export function ProjectNameField({
  register,
  errors,
  value,
  isLoading,
}: ProjectNameFieldProps) {
  const hasError = !!errors.projectName;

  return (
    <Field
      id="projectName"
      label="Project Name"
      placeholder="e.g. My Main Repository"
      value={value}
      disabled={isLoading}
      ariaInvalid={hasError}
      registration={register("projectName")}
      helper={
        hasError ? (
          <span className="font-gv-mono text-xs text-gv-ember">
            {errors.projectName?.message || "Project name is required"}
          </span>
        ) : (
          <span className="font-gv-mono text-xs text-gv-fog/80">
            Internal label inside GitVision — doesn&apos;t change your repository on GitHub.
          </span>
        )
      }
    />
  );
}
