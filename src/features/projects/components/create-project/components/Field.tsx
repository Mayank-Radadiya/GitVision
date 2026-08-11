/**
 * =============================================================================
 * FORM FIELD COMPONENT — Linear & Vercel Style Craftsmanship
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
            "font-gv-mono text-[11px] font-semibold tracking-wider uppercase transition-colors duration-150",
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
            "bg-gv-graphite-2/90 font-gv-body text-gv-bone w-full rounded-xl border border-white/8 px-4 py-3 text-sm shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)] transition-all duration-200",
            "placeholder:text-gv-fog/40 focus:outline-none",
            "focus:border-gv-amber/70 focus:bg-gv-graphite-2 focus:ring-gv-amber/15 focus:ring-[3px]",
            ariaInvalid &&
              "border-gv-ember/80 focus:border-gv-ember focus:ring-gv-ember/20 gv-input-error",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
      </div>

      {helper ? <div className="min-h-5">{helper}</div> : null}
    </div>
  );
}
