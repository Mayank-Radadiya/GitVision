"use client";

/**
 * Compact stat card with animated counter and color-coded icon.
 * Memoized — only rerenders when its specific stat value changes.
 */

import { memo, useEffect, useState } from "react";
import { animate } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { COLOR_TOKENS } from "@/features/dashboard/constants/dashboard.constants";
import type { StatColor } from "@/features/dashboard/types/dashboard.types";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: StatColor;
  description: string;
}

/** Animated counter — counts from 0 to target over 1.2s */
function AnimatedValue({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const ctrl = animate(0, target, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => ctrl.stop();
  }, [target]);

  return <>{display.toLocaleString()}</>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  description,
}: StatCardProps) {
  const tokens = COLOR_TOKENS[color];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-3",
        "bg-card/80 backdrop-blur-xl",
        tokens.border,
        "shadow-sm hover:shadow-md transition-all duration-200",
        "cursor-default",
      )}
    >
      {/* Ambient glow */}
      <div
        className={cn(
          "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-15 blur-2xl",
          "transition-opacity duration-300 group-hover:opacity-30",
          `bg-gradient-to-br ${tokens.gradient}`,
        )}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        {/* Text content */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            <AnimatedValue target={value} />
          </p>
          <p className="text-xs text-muted-foreground/70">{description}</p>
        </div>

        {/* Icon */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            "bg-gradient-to-br text-white shadow-lg",
            tokens.gradient,
            tokens.glow,
            "transition-transform duration-200 group-hover:scale-105",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default memo(StatCard);