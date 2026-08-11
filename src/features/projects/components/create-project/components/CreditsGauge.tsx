/**
 * =============================================================================
 * AI CREDITS GAUGE — contribution-graph squares, not a linear bar (brief §5.7)
 * =============================================================================
 */

"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { useDashboardInfo } from "@/features/dashboard/hooks/use-dashboard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

const SQUARES = 12;
const MAX_CREDITS = 100;

export function CreditsGauge() {
  const { data } = useDashboardInfo();
  const credits = data?.userCredits ?? 0;
  const filled = Math.min(
    Math.round((credits / MAX_CREDITS) * SQUARES),
    SQUARES,
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-gv-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gv-fog">
        AI credits
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="img"
            aria-label={`${credits} of ${MAX_CREDITS} AI credits remaining`}
            className="flex cursor-help items-center gap-[3px]"
          >
            {Array.from({ length: SQUARES }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[9px] w-[9px] rounded-[2px] transition-colors duration-150",
                  i < filled ? "bg-gv-amber" : "bg-gv-hairline",
                )}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent className="font-gv-mono text-xs">
          {credits} / {MAX_CREDITS}
        </TooltipContent>
      </Tooltip>
      <Link
        href="/billing"
        className="font-gv-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gv-amber transition-colors duration-150 hover:text-gv-bone"
      >
        Get more →
      </Link>
    </div>
  );
}
