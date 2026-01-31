/**
 * =============================================================================
 * PROJECT CARD SKELETON
 * =============================================================================
 *
 * Loading skeleton that matches the new compact repository card layout.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { memo } from "react";

const ProjectCardSkeleton = () => (
  <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 p-4">
    {/* Avatar Skeleton */}
    <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />

    {/* Content */}
    <div className="flex-1 space-y-2">
      <Skeleton className="h-5 w-48 rounded" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>

    {/* Arrow */}
    <Skeleton className="h-5 w-5 shrink-0 rounded" />
  </div>
);

export default memo(ProjectCardSkeleton);
