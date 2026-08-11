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
        <Coins className="text-gv-amber h-4 w-4" />
        <span className="font-gv-mono text-gv-bone text-xs font-semibold tracking-wider uppercase">
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
                    "h-2.5 w-2.5 rounded-xs transition-colors duration-150",
                    i < filled
                      ? "bg-gv-amber shadow-[0_0_5px_rgba(232,163,61,0.25)]"
                      : "bg-gv-hairline/80",
                  )}
                />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent className="font-gv-mono border-gv-hairline bg-gv-graphite text-gv-bone border text-xs">
            {credits} / {MAX_CREDITS} Credits Available
          </TooltipContent>
        </Tooltip>

        <span className="font-gv-mono text-gv-amber text-xs font-bold">
          {credits}
        </span>
      </div>

      <Link
        href="/billing"
        className="font-gv-mono text-gv-amber hover:text-gv-bone text-xs font-medium transition-colors hover:underline"
      >
        Top up →
      </Link>
    </div>
  );
}
