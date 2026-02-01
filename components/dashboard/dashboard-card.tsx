"use client";

/**
 * =============================================================================
 * PREMIUM DASHBOARD STAT CARD
 * =============================================================================
 *
 * A premium stat card component for displaying key metrics with:
 * - Glassmorphism effect with backdrop blur
 * - Animated count-up numbers
 * - Gradient icon backgrounds with subtle glow
 * - Smooth hover animations
 * - Optional trend indicator
 *
 * @module components/dashboard/dashboard-card
 */

import { Card } from "../ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { motion, animate } from "framer-motion";
import { memo, useEffect, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface DashboardCardProps {
  /** The numeric value to display */
  number: number;
  /** Card title/label */
  name: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Color theme for the card */
  color?: "blue" | "green" | "purple" | "amber" | "rose" | "indigo" | "cyan";
  /** Descriptive subtitle */
  description?: string;
  /** Optional trend percentage (positive = up, negative = down) */
  trend?: number;
}

// =============================================================================
// COLOR CONFIGURATION
// =============================================================================

const colorConfig = {
  blue: {
    gradient: "from-blue-500 to-blue-600",
    glow: "shadow-blue-500/25",
    border: "border-blue-500/20 hover:border-blue-500/40",
    accent: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  green: {
    gradient: "from-emerald-500 to-emerald-600",
    glow: "shadow-emerald-500/25",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    accent: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  purple: {
    gradient: "from-violet-500 to-violet-600",
    glow: "shadow-violet-500/25",
    border: "border-violet-500/20 hover:border-violet-500/40",
    accent: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
  },
  amber: {
    gradient: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/25",
    border: "border-amber-500/20 hover:border-amber-500/40",
    accent: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    gradient: "from-rose-500 to-pink-600",
    glow: "shadow-rose-500/25",
    border: "border-rose-500/20 hover:border-rose-500/40",
    accent: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
  },
  indigo: {
    gradient: "from-indigo-500 to-indigo-600",
    glow: "shadow-indigo-500/25",
    border: "border-indigo-500/20 hover:border-indigo-500/40",
    accent: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  cyan: {
    gradient: "from-cyan-500 to-teal-500",
    glow: "shadow-cyan-500/25",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    accent: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
  },
};

// =============================================================================
// ANIMATED COUNTER COMPONENT
// =============================================================================

/**
 * Animated number that counts up from 0 to the target value
 */
function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      },
    });

    return () => controls.stop();
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const DashboardCard: React.FC<DashboardCardProps> = ({
  number,
  name,
  icon: Icon,
  color = "blue",
  description,
  trend,
}) => {
  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card
        className={cn(
          // Base styles
          "relative overflow-hidden rounded-2xl border p-6",
          // Glassmorphism
          "bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl",
          // Border with color theme
          config.border,
          // Shadow and hover effects
          "shadow-lg shadow-black/5 dark:shadow-black/20",
          "hover:shadow-xl transition-all duration-300",
        )}
      >
        {/* Gradient Accent Background */}
        <div
          className={cn(
            "absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-40",
            `bg-gradient-to-br ${config.gradient}`,
          )}
        />

        {/* Content Container */}
        <div className="relative z-10">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            {/* Title & Description */}
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                {name}
              </h3>
              {description && (
                <p className="text-xs text-muted-foreground/70">
                  {description}
                </p>
              )}
            </div>

            {/* Icon with Gradient Background & Glow */}
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                "bg-gradient-to-br text-white",
                config.gradient,
                "shadow-lg",
                config.glow,
                "transition-transform duration-300 group-hover:scale-110",
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          </div>

          {/* Number Display */}
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold tracking-tight text-foreground">
              <AnimatedCounter value={number} />
            </span>

            {/* Trend Indicator */}
            {trend !== undefined && (
              <div
                className={cn(
                  "mb-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  trend >= 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(trend)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Gradient Line */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1",
            "bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            config.gradient,
          )}
        />
      </Card>
    </motion.div>
  );
};

export default memo(DashboardCard);
