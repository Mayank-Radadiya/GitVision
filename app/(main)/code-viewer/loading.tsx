import { Skeleton } from "@/shared/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div>
          <Skeleton className="h-7 w-40 mb-1.5" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>

      {/* Command + list skeleton */}
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
