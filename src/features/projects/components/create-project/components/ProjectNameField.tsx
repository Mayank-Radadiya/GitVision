/**
 * =============================================================================
 * PROJECT NAME FIELD — floating label + neutral helper (brief §5.4/§7)
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
  return (
    <Field
      id="projectName"
      label="Project Name"
      value={value}
      disabled={isLoading}
      registration={register("projectName")}
      helper={
        <span className="font-gv-mono text-xs text-gv-fog">
          This is just a label inside GitVision — it doesn&apos;t change anything
          on GitHub.
        </span>
      }
    />
  );
}
