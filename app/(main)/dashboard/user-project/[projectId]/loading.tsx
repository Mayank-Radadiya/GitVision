/**
 * Project Page Loading Skeleton
 * Shown during server-side rendering / navigation transitions
 */

import { Skeleton } from "@/shared/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-8">
        {/* Back button + Header */}
        <div className="space-y-5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>

        {/* Tabs */}
        <Skeleton className="h-12 w-72 rounded-xl" />

        {/* Commits List */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <Skeleton className="h-32 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
