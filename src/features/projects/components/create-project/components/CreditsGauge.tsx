/**
 * =============================================================================
 * AI CREDITS GAUGE — Contribution Graph Style Meter
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
import { Coins } from "lucide-react";

const SQUARES = 10;
const MAX_CREDITS = 100;

export function CreditsGauge() {
  const { data } = useDashboardInfo();
  const credits = data?.userCredits ?? 50;
  const filled = Math.min(
    Math.round((credits / MAX_CREDITS) * SQUARES),
    SQUARES,
  );

  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-gv-amber" />
        <span className="font-gv-mono text-xs font-semibold uppercase tracking-wider text-gv-bone">
          AI Credits
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="img"
              aria-label={`${credits} of ${MAX_CREDITS} AI credits remaining`}
              className="flex cursor-help items-center gap-1"
            >
              {Array.from({ length: SQUARES }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-[2px] transition-colors duration-150",
                    i < filled ? "bg-gv-amber shadow-[0_0_5px_rgba(232,163,61,0.25)]" : "bg-gv-hairline/80",
                  )}
                />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent className="font-gv-mono text-xs border border-gv-hairline bg-gv-graphite text-gv-bone">
            {credits} / {MAX_CREDITS} Credits Available
          </TooltipContent>
        </Tooltip>

        <span className="font-gv-mono text-xs font-bold text-gv-amber">
          {credits}
        </span>
      </div>

      <Link
        href="/billing"
        className="font-gv-mono text-xs font-medium text-gv-amber transition-colors hover:text-gv-bone hover:underline"
      >
        Top up →
      </Link>
    </div>
  );
}
