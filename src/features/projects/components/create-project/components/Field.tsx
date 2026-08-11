/**
 * =============================================================================
 * FORM FIELD COMPONENT — Raised Dark Input with a Soft Focus Ring
 * =============================================================================
 */

"use client";

import { useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/shared/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  actionButton?: ReactNode;
  helper?: ReactNode;
  registration: UseFormRegisterReturn;
}

export function Field({
  id,
  label,
  value,
  type = "text",
  placeholder,
  autoComplete,
  disabled,
  ariaInvalid,
  actionButton,
  helper,
  registration,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className={cn(
            "font-gv-mono text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150",
            focused ? "text-gv-amber" : "text-gv-fog",
          )}
        >
          {label}
        </label>
        {actionButton}
      </div>

      <div className="relative">
        <input
          {...registration}
          id={id}
          type={type}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-label={label}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder || label}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            registration.onBlur(e);
          }}
          className={cn(
            "h-11 w-full rounded-lg border border-gv-hairline bg-gv-graphite-2/60 px-4 font-gv-body text-[15px] text-gv-bone transition-all duration-200",
            "placeholder:text-gv-fog/40 focus:outline-none",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
            "focus:border-gv-amber/60 focus:bg-gv-graphite-2/80 focus:shadow-none focus:ring-[3px] focus:ring-gv-amber/15",
            ariaInvalid &&
              "border-gv-ember/80 focus:border-gv-ember focus:ring-gv-ember/15 gv-input-error",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
      </div>

      {helper ? <div className="min-h-[20px]">{helper}</div> : null}
    </div>
  );
}