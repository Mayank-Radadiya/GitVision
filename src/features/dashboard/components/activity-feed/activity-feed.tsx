"use client";

/**
 * Activity feed — timeline of recent commits across all user projects.
 * Subscribes to useRecentActivity() — isolated rerender scope.
 */

import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { GitCommit, Clock } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useRecentActivity } from "@/features/dashboard/hooks/use-dashboard";

/** Single activity entry */
function ActivityItem({
  message,
  project,
  author,
  date,
}: {
  message: string;
  project: string;
  author: string;
  date: Date;
}) {
  const timeAgo = formatDistanceToNow(new Date(date), { addSuffix: true });

  return (
    <div className="group flex gap-3 py-3 first:pt-0 last:pb-0">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1">
        <div className="h-2 w-2 rounded-full bg-primary/60 group-hover:bg-primary transition-colors" />
        <div className="mt-1 w-px flex-1 bg-border/40" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-3">
        <p className="truncate text-sm text-foreground leading-snug">
          {message}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/70">
          <span className="font-medium text-muted-foreground">{project}</span>
          <span>·</span>
          <span>{author}</span>
          <span>·</span>
          <div className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityFeed() {
  const { data: activities, isLoading } = useRecentActivity();

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-xl",
        "shadow-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <GitCommit className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Recent Activity
        </h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-2 w-2 shrink-0 rounded-full mt-1.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!activities || activities.length === 0) && (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          No recent activity
        </p>
      )}

      {/* Activity List */}
      {!isLoading && activities && activities.length > 0 && (
        <div className="divide-y-0">
          {activities.map((a) => (
            <ActivityItem
              key={a.id}
              message={a.commitMessage}
              project={a.projectName}
              author={a.authorName}
              date={a.authorDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ActivityFeed);
