import { Skeleton } from "@/shared/components/ui/skeleton";
import { ProjectPanel, ListSkeleton } from "../workspace-ui";

export function OverviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading project overview"
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>
      <div className="project-metrics grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <ProjectPanel key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-3 h-3 w-full" />
          </ProjectPanel>
        ))}
      </div>
      <div className="overview-row">
        <ProjectPanel>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-8 w-36" />
          <Skeleton className="mt-5 h-[240px] w-full" />
          <Skeleton className="mt-5 h-14 w-full" />
        </ProjectPanel>
        <ProjectPanel>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-3 w-40" />
          <Skeleton className="mt-6 h-64 w-full" />
        </ProjectPanel>
      </div>
      <div className="overview-row">
        <ProjectPanel>
          <Skeleton className="mb-5 h-4 w-28" />
          <ListSkeleton />
        </ProjectPanel>
        <ProjectPanel>
          <Skeleton className="mb-5 h-4 w-28" />
          <ListSkeleton rows={4} />
        </ProjectPanel>
      </div>
      <div className="overview-context">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <span className="sr-only">Loading project overview…</span>
    </div>
  );
}
export default OverviewSkeleton;
