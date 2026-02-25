"use client";

/**
 * "Needs Attention" widget — surfaces open issues and pull requests
 * across all user projects so nothing falls through the cracks.
 */

import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, GitPullRequest, CircleDot, Clock } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useNeedsAttention } from "@/features/dashboard/hooks/use-dashboard";

function NeedsAttention() {
  const { data, isLoading } = useNeedsAttention();

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl",
        "shadow-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Needs Attention
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || (data.openIssuesCount === 0 && data.openPRsCount === 0) ? (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          All clear — no open items
        </p>
      ) : (
        <>
          {/* Count badges */}
          <div className="mb-4 flex gap-2">
            {data.openPRsCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
                <GitPullRequest className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-500">
                  {data.openPRsCount} PR{data.openPRsCount !== 1 && "s"}
                </span>
              </div>
            )}
            {data.openIssuesCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1">
                <CircleDot className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-500">
                  {data.openIssuesCount} Issue
                  {data.openIssuesCount !== 1 && "s"}
                </span>
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="space-y-1">
            {data.items.map((item) => {
              const timeAgo = formatDistanceToNow(
                new Date(item.githubUpdatedAt),
                { addSuffix: true },
              );

              return (
                <div
                  key={item.id}
                  className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
                >
                  {/* Type icon */}
                  <div className="mt-0.5 shrink-0">
                    {item.isPullRequest ? (
                      <GitPullRequest className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-foreground leading-snug">
                      {item.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                      <span className="font-medium text-muted-foreground">
                        {item.projectName}
                      </span>
                      <span>·</span>
                      <span>#{item.issueNumber}</span>
                      <span>·</span>
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{timeAgo}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(NeedsAttention);
