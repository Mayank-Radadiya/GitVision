import { Skeleton } from "@/shared/components/ui/skeleton";

export function SectionSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading project section"
      className="space-y-4"
    >
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <span className="sr-only">Loading project section…</span>
    </div>
  );
}

export default function WorkspaceSkeleton() {
  return (
    <div className="project-workspace bg-background min-h-screen">
      <div className="border-border border-b px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="ml-12 h-5 w-36 md:ml-0" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-9 w-64" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-14 w-full" />
        <SectionSkeleton />
      </div>
    </div>
  );
}
