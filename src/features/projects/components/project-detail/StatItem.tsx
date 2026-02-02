"use client";

import { ReactNode } from "react";

interface StatItemProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
}

export const StatItem = ({ icon, label, value, trend }: StatItemProps) => {
  // Format large numbers with commas
  const formattedValue =
    typeof value === "number" ? value.toLocaleString("en-US") : value;

  return (
    <div className="flex items-start gap-3 group cursor-default">
      {/* Icon Container */}
      <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg group-hover:from-primary/15 group-hover:to-primary/10 transition-all duration-200">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-[family-name:var(--font-fira-sans)] mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-fira-code)] tabular-nums">
          {formattedValue}
        </p>
      </div>

      {/* Optional Trend Indicator */}
      {trend && (
        <div
          className={`text-xs font-semibold px-2 py-1 rounded-full ${
            trend === "up"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : trend === "down"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
        </div>
      )}
    </div>
  );
};
