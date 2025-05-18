import { Skeleton } from "@/components/ui/skeleton";
import { memo } from "react";
// Skeleton component for project cards
const ProjectCardSkeleton = () => (
  <div className="rounded-xl border border-blue-200/30 dark:border-blue-800/30 p-5 bg-white/40 dark:bg-slate-900/40 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <Skeleton className="h-7 w-3/5" />
      <Skeleton className="h-6 w-12 rounded-full" />
    </div>
    <Skeleton className="h-4 w-3/4 mb-4" />
    <div className="grid grid-cols-3 gap-2 mb-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
    <div className="flex justify-between items-center mt-4">
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  </div>
);

export default memo(ProjectCardSkeleton);
