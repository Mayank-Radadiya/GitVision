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
        <div className="bg-primary/60 group-hover:bg-primary h-2 w-2 rounded-full transition-colors" />
        <div className="bg-border/40 mt-1 w-px flex-1" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-3">
        <p className="text-foreground truncate text-sm leading-snug">
          {message}
        </p>
        <div className="text-muted-foreground/70 mt-1 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">{project}</span>
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
        "border-border/60 bg-card/80 rounded-2xl border p-5 backdrop-blur-xl",
        "shadow-sm",
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <GitCommit className="text-primary h-4 w-4" />
        <h3 className="text-foreground text-sm font-semibold">
          Recent Activity
        </h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
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
        <p className="text-muted-foreground/60 py-8 text-center text-sm">
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
