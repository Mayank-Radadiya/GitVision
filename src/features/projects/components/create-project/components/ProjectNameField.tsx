/**
 * PROJECT NAME FIELD — Instant Smart Name with Seamless Direct Input
 */

"use client";

import { useState, useEffect } from "react";
import { FolderGit2, AlertCircle, Wand2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { CreateProjectInput } from "../add-repo.constants";
import { extractRepoInfo, deriveProjectName } from "../add-repo.utils";

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
  const [isFocused, setIsFocused] = useState(false);
  const [isTouchedByUser, setIsTouchedByUser] = useState(false);

  const hasError = !!errors.projectName;
  const repoInfo = extractRepoInfo(repoUrl);
  const derivedName = repoInfo ? deriveProjectName(repoInfo.repo) : "";

  // Auto-sync project name from repo if not manually typed by user
  useEffect(() => {
    if (!isTouchedByUser && derivedName && setValue && (!value || value === derivedName)) {
      setValue("projectName", derivedName, {
        shouldValidate: true,
      });
    }
  }, [derivedName, isTouchedByUser, setValue, value]);

  const handleAutoFill = () => {
    if (derivedName && setValue) {
      setValue("projectName", derivedName, {
        shouldValidate: true,
        shouldTouch: true,
      });
      setIsTouchedByUser(false);
    }
  };

  const registration = register("projectName");

  return (
    <div className="space-y-2.5">
      {/* Top Label & Action Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="projectName"
            className={cn(
              "font-gv-mono text-[11px] font-semibold tracking-wider uppercase transition-colors duration-150",
              isFocused ? "text-gv-amber" : "text-gv-fog",
            )}
          >
            Project name
          </label>
          <span aria-hidden="true" className="text-gv-amber text-xs font-bold">
            *
          </span>
        </div>

        {/* Auto-fill trigger if derived name is available */}
        {derivedName && setValue && value !== derivedName && (
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={isLoading}
            className="text-gv-amber hover:text-gv-bone font-gv-mono inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
            title={`Reset to repo name: ${derivedName}`}
          >
            <Wand2 className="h-3 w-3" />
            <span>Use repo name ({derivedName})</span>
          </button>
        )}
      </div>

      {/* Input Field Container */}
      <div className="relative">
        <div
          className={cn(
            "relative flex items-center rounded-xl border bg-gv-graphite-2/90 transition-[border-color,background-color,box-shadow] duration-[120ms] ease-out",
            isFocused
              ? "border-gv-amber/70 bg-gv-graphite-2 shadow-[0_0_0_1px_rgba(232,163,61,0.4),0_0_16px_rgba(232,163,61,0.1)]"
              : "border-white/8 hover:border-white/14 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]",
            hasError &&
              "border-gv-ember/80 focus-within:border-gv-ember focus-within:ring-2 focus-within:ring-gv-ember/20 gv-input-error",
            isLoading ? "cursor-not-allowed opacity-60" : "",
          )}
        >
          {/* Prefix Icon */}
          <div className="pl-3.5 pr-1 text-gv-fog/70 select-none">
            <FolderGit2 className="h-4 w-4 text-gv-amber" />
          </div>

          {/* Actual Input */}
          <input
            {...registration}
            id="projectName"
            type="text"
            disabled={isLoading}
            aria-invalid={hasError}
            aria-describedby={hasError ? "projectName-error" : undefined}
            placeholder={derivedName || "e.g. React Production"}
            autoComplete="off"
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              setIsFocused(false);
              registration.onBlur(e);
            }}
            onChange={(e) => {
              setIsTouchedByUser(true);
              registration.onChange(e);
            }}
            className="font-gv-body text-gv-bone placeholder:text-gv-fog/40 w-full bg-transparent px-2.5 py-3 text-sm focus:outline-none"
          />

          {/* Badge indicator on right */}
          {value && derivedName && value === derivedName && (
            <div className="pr-3">
              <span className="border-gv-hairline bg-gv-graphite text-gv-fog/80 rounded border px-2 py-0.5 font-mono text-[10px]">
                Auto-derived
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error or hint */}
      {hasError ? (
        <div
          id="projectName-error"
          className="font-gv-mono text-gv-ember flex items-center gap-1.5 text-xs"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errors.projectName?.message || "Project name is required."}</span>
        </div>
      ) : (
        <div className="font-gv-mono text-gv-fog/70 text-[11px]">
          Used across project tabs, search, and chat.
        </div>
      )}
    </div>
  );
}
