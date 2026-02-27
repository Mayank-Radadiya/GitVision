"use client";

/**
 * "Needs Attention" widget — shows open issues and pull requests.
 * Shows 3 items by default, expandable to show all.
 */

import { memo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, GitPullRequest, CircleDot, Clock } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useNeedsAttention } from "@/features/dashboard/hooks/use-dashboard";

function NeedsAttention() {
  const { data, isLoading } = useNeedsAttention();
  const [isExpanded, setIsExpanded] = useState(false);

  const totalItems = (data?.openIssuesCount ?? 0) + (data?.openPRsCount ?? 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-5 backdrop-blur-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Needs Attention</h3>

        {/* Count badges */}
        {!isLoading && data && totalItems > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {data.openPRsCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                <GitPullRequest className="h-3 w-3" />
                {data.openPRsCount}
              </span>
            )}
            {data.openIssuesCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                <CircleDot className="h-3 w-3" />
                {data.openIssuesCount}
              </span>
            )}
          </div>
        )}

        {isLoading && (
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        )}
      </div>

      {/* Empty state */}
      {!isLoading && totalItems === 0 && (
        <p className="text-xs text-muted-foreground/60">
          All clear — no open items
        </p>
      )}

      {/* Item list */}
      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-0.5">
          {(isExpanded ? data.items : data.items.slice(0, 3)).map((item) => {
            const timeAgo = formatDistanceToNow(
              new Date(item.githubUpdatedAt),
              { addSuffix: true },
            );

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/20",
                  item.isPullRequest
                    ? "border-l-2 border-l-emerald-500/40"
                    : "border-l-2 border-l-amber-500/40",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {item.isPullRequest ? (
                    <GitPullRequest className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <CircleDot className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-medium text-foreground leading-snug">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
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

          {data.items.length > 3 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 w-full cursor-pointer rounded-lg py-1.5 text-center text-[11px] font-medium text-primary/70 transition-colors hover:bg-muted/20 hover:text-primary"
            >
              {isExpanded ? "Show less" : `View all ${data.items.length} items`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(NeedsAttention);
