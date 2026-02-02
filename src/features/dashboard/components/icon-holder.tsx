"use client";

/**
 * =============================================================================
 * ICON HOLDER / STAT ITEM COMPONENT
 * =============================================================================
 *
 * A compact stat display component with icon and value.
 * Used for displaying repository statistics in a clean, modern format.
 *
 * @module components/dashboard/IconHolder
 */

import { memo } from "react";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface IconHolderProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Label text */
  label: string;
  /** Value to display */
  value: number | string;
  /** Background color class */
  bgColor?: string;
  /** Text color class */
  textColor?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Compact stat item with icon, label, and value
 *
 * Features:
 * - Rounded icon container with custom colors
 * - Clean typography hierarchy
 * - Hover animation
 */
const IconHolder = ({
  icon,
  label,
  value,
  bgColor = "bg-emerald-100 dark:bg-emerald-900/30",
  textColor = "text-emerald-600 dark:text-emerald-400",
}: IconHolderProps) => (
  <div className="group flex items-center gap-2.5 transition-all duration-200 hover:translate-x-0.5">
    {/* Icon Container */}
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200",
        "group-hover:scale-110",
        bgColor,
        textColor,
      )}
    >
      {icon}
    </div>

    {/* Label & Value */}
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  </div>
);

export default memo(IconHolder);
