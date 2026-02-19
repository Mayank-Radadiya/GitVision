import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      {/* Main content — centered */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-10">
          {/* Header Skeleton */}
          <div className="flex flex-col items-center space-y-2 text-center">
            <Skeleton className="h-9 w-64" /> {/* Title */}
            <Skeleton className="h-4 w-96" /> {/* Subtitle */}
          </div>

          {/* Mode selection Skeleton */}
          <div className="space-y-4">
            {/* Project selector */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <Skeleton className="h-9 flex-1" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Skeleton className="h-11 flex-1" />
              <Skeleton className="h-11 flex-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent conversations — bottom */}
      <div className="border-t border-border/40 px-6 py-5">
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
