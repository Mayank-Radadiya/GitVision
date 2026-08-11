/**
 * =============================================================================
 * FLOATING-LABEL FIELD (Brief § Layout & Tokens)
 * =============================================================================
 *
 * Floating label lifts into a monospace uppercase caption.
 * Visible focus ring in amber (--ember-500).
 */

"use client";

import { useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/shared/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  /** Current field value — drives the floating-label lift. */
  value: string;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  /** Content rendered below the field (neutral/valid/invalid helper). */
  helper?: ReactNode;
  /** Return value of react-hook-form register(name). */
  registration: UseFormRegisterReturn;
}

export function Field({
  id,
  label,
  value,
  type = "text",
  autoComplete,
  disabled,
  ariaInvalid,
  helper,
  registration,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div className="space-y-2">
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
          placeholder={label}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            registration.onBlur(e);
          }}
          className={cn(
            "peer w-full rounded-md border border-gv-hairline bg-gv-graphite-2 px-3.5 pb-2 pt-6 font-gv-body text-base text-gv-bone",
            "placeholder-transparent focus:outline-none",
            "focus:border-gv-amber focus:ring-2 focus:ring-gv-amber/50",
            ariaInvalid && "border-gv-ember gv-input-error",
            "transition-all duration-200 disabled:opacity-50",
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-3.5 transition-all duration-200 ease-out",
            lifted
              ? "top-1.5 font-gv-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
              : "top-3.5 font-gv-body text-base font-normal",
            focused ? "text-gv-amber" : lifted ? "text-gv-fog" : "text-gv-fog/70",
          )}
        >
          {label}
        </label>
        {/* Amber accent line on focus */}
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 left-0 h-0.5 w-full origin-left bg-gv-amber transition-transform duration-200 ease-out",
            focused ? "scale-x-100" : "scale-x-0",
          )}
        />
      </div>
      {helper ? <div className="min-h-[18px]">{helper}</div> : null}
    </div>
  );
}
