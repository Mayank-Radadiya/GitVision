import { OverviewSkeleton } from "./overview/overview-skeleton";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ListSkeleton } from "./workspace-ui";

export function SectionSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading project section"
      className="space-y-5"
    >
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-full" />
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <ListSkeleton />
      </div>
      <span className="sr-only">Loading project section…</span>
    </div>
  );
}
export default function WorkspaceSkeleton() {
  return (
    <div className="project-workspace bg-background min-h-screen">
      <div className="mx-auto max-w-[1280px] px-4 pt-4 pb-6 md:px-8">
        <Skeleton className="mb-6 ml-12 h-9 w-36 md:ml-0" />
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-3 h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-64" />
        </div>
      </div>
      <div className="border-border border-b">
        <div className="mx-auto flex max-w-[1280px] gap-6 overflow-hidden px-4 py-3.5 md:px-8">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-20 shrink-0" />
          ))}
        </div>
      </div>
      <div className="project-content mx-auto max-w-[1280px] px-4 pt-6 pb-12 md:px-8">
        <OverviewSkeleton />
      </div>
    </div>
  );
}
