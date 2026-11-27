"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { cn } from "@/shared/lib/utils";
import { useCredits } from "@/features/dashboard/hooks/use-dashboard";
import { trpc } from "@/src/lib/trpc/client";
import { SidebarTooltip } from "./SidebarTooltip";

interface SidebarCreditsProps {
  /** Whether sidebar is collapsed */
  isCollapsed: boolean;
}

const CLAIM_AMOUNT = 50;
const DAILY_GRANT = 5;
const MAX_FREE_CREDITS = 100;

/**
 * Compact AI Credits instrumentation widget with progress bar and 24h claim action.
 */
export function SidebarCredits({ isCollapsed }: SidebarCreditsProps) {
  // The sidebar renders on every page, so this asks for the balance alone
  // rather than dragging the whole dashboard payload along with it.
  const { data } = useCredits();
  const credits = data ?? 0;

  const [justClaimed, setJustClaimed] = useState(false);
  const claimedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (claimedTimerRef.current) {
        clearTimeout(claimedTimerRef.current);
      }
    };
  }, []);

  const utils = trpc.useUtils();
  const claim = trpc.credits.claim.useMutation({
    onSuccess: ({ balance }) => {
      utils.project.getCredits.invalidate();
      utils.user.getCreditHistory.invalidate();
      setJustClaimed(true);
      if (claimedTimerRef.current) {
        clearTimeout(claimedTimerRef.current);
      }
      claimedTimerRef.current = setTimeout(() => {
        setJustClaimed(false);
      }, 2200);
      toast.success(`Claimed! You now have ${balance} credits.`, {
        icon: <Zap className="h-4 w-4 text-amber-500" />,
      });
    },
    onError: (error) => {
      toast.error(
        error.message || "Couldn't claim credits. Please try again.",
        { icon: <Zap className="h-4 w-4 text-rose-500" /> },
      );
    },
  });

  const percentage = Math.min((credits / MAX_FREE_CREDITS) * 100, 100);
  const isWarning = percentage <= 20 && percentage > 5;
  const isCritical = percentage <= 5;

  const barColorClass = isCritical
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-primary";

  const iconColorClass = isCritical
    ? "text-red-500"
    : isWarning
      ? "text-amber-500"
      : "text-primary";

  if (isCollapsed) {
    return (
      <div className="px-2 pb-2.5">
        <SidebarTooltip
          content={
            justClaimed
              ? `Claimed! ${credits} / ${MAX_FREE_CREDITS} credits`
              : `${credits} / ${MAX_FREE_CREDITS} AI credits · Click to claim`
          }
          side="right"
        >
          <button
            type="button"
            onClick={() => claim.mutate()}
            disabled={claim.isPending}
            aria-label={`${credits} of ${MAX_FREE_CREDITS} AI credits remaining. Claim daily credits`}
            className={cn(
              "border-border/70 bg-background/60 hover:bg-sidebar-accent hover:border-border focus-visible:ring-sidebar-ring relative mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-all duration-150 outline-none focus-visible:ring-2 active:scale-95 disabled:opacity-60 dark:bg-white/[0.03]",
            )}
          >
            {claim.isPending ? (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            ) : justClaimed ? (
              <Check className="h-4 w-4 text-emerald-500" strokeWidth={2} />
            ) : (
              <Zap
                className={cn("h-4 w-4 transition-colors", iconColorClass)}
                strokeWidth={1.75}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "ring-sidebar absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2",
                justClaimed ? "bg-emerald-500" : barColorClass,
              )}
            />
          </button>
        </SidebarTooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <div className="border-border/70 bg-background/60 rounded-lg border p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] transition-colors duration-200 dark:bg-white/[0.025]">
        {/* Header Row: Label + Tabular Balance */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Zap
              aria-hidden="true"
              className={cn("h-3.5 w-3.5 shrink-0", iconColorClass)}
              strokeWidth={2}
            />
            <span className="text-foreground text-xs font-medium tracking-tight">
              AI Credits
            </span>
          </div>

          <div className="flex items-baseline gap-0.5 font-mono">
            <span className="text-foreground text-[13px] font-semibold tabular-nums">
              {credits}
            </span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              /{MAX_FREE_CREDITS}
            </span>
          </div>
        </div>

        {/* Progress Track */}
        <div
          role="progressbar"
          aria-label="AI credits remaining"
          aria-valuenow={credits}
          aria-valuemin={0}
          aria-valuemax={MAX_FREE_CREDITS}
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full dark:bg-white/[0.07]"
        >
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors duration-300",
              barColorClass,
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Rule Copy + Claim Action */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-[11px] leading-tight">
            +{CLAIM_AMOUNT}/24h · {DAILY_GRANT}/day free
          </p>

          <button
            type="button"
            onClick={() => claim.mutate()}
            disabled={claim.isPending}
            className={cn(
              "focus-visible:ring-sidebar-ring inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60",
              justClaimed
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : "border-border/80 bg-background/80 text-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:bg-white/[0.04]",
            )}
          >
            {claim.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Claiming</span>
              </>
            ) : justClaimed ? (
              <>
                <Check className="h-3 w-3" strokeWidth={2.25} />
                <span>Claimed</span>
              </>
            ) : (
              <span>Claim</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
