import { Skeleton } from "@/components/ui/skeleton";
import { memo } from "react";

const ProjectCardSkeleton = () => (
  <div className="relative rounded-2xl h-64 border border-border p-5 bg-white/50 dark:bg-card shadow-sm space-y-4 overflow-hidden group hover:shadow-md transition-all duration-300">
    {/* Title + Icon */}
    <div className="flex justify-between items-center">
      <Skeleton className="h-7 w-2/3 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>

    {/* Subtitle */}
    <Skeleton className="h-4 w-3/5 rounded-md mt-2" />

    {/* Stats Row */}
    <div className="grid grid-cols-2 gap-3 mt-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-56  rounded-md" />
        <Skeleton className="h-6 w-56  rounded-md" />
        <Skeleton className="h-6 w-56  rounded-md" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-56  rounded-md" />
        <Skeleton className="h-6 w-56  rounded-md" />
        <Skeleton className="h-6 w-56  rounded-md" />
      </div>
    </div>
  </div>
);

export default memo(ProjectCardSkeleton);
