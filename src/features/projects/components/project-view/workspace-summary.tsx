import { memo } from "react";
import {
  FileCheck2,
  GitCommitHorizontal,
  Users,
  Clock3,
  GitBranch,
} from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { ProjectTab } from "@/features/projects/types/project.types";

interface Props {
  isLoading: boolean;
  indexedFileCount?: number | null;
  totalFileCount?: number | null;
  embeddingStatus?: string | null;
  totalCommits?: number;
  totalContributors?: number;
  totalBranches?: number;
  lastSyncedAt?: Date | string | null;
  onNavigate: (tab: ProjectTab) => void;
  onOpenDetails: () => void;
}

function WorkspaceSummary(props: Props) {
  const total = props.totalFileCount ?? 0;
  const indexed = props.indexedFileCount ?? 0;
  const coverage =
    total > 0 ? Math.min(100, Math.round((indexed / total) * 100)) : null;
  const cards = [
    {
      label: "AI index coverage",
      value: coverage === null ? "—" : `${coverage}%`,
      detail:
        total > 0
          ? `${indexed.toLocaleString()} of ${total.toLocaleString()} files`
          : "Waiting for index counts",
      icon: FileCheck2,
      action: props.onOpenDetails,
    },
    {
      label: "Commits",
      value: (props.totalCommits ?? 0).toLocaleString(),
      detail: "Explore repository activity",
      icon: GitCommitHorizontal,
      action: () => props.onNavigate("commits"),
    },
    {
      label: "Contributors",
      value: (props.totalContributors ?? 0).toLocaleString(),
      detail: "Repository contributors",
      icon: Users,
      action: () => props.onNavigate("team"),
    },
    {
      label: "Branches",
      value: (props.totalBranches ?? 0).toLocaleString(),
      detail: "Tracked in this repository",
      icon: GitBranch,
      action: props.onOpenDetails,
    },
    {
      label: "Last synced",
      value: props.lastSyncedAt
        ? new Date(props.lastSyncedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Not yet",
      detail: props.lastSyncedAt
        ? "Latest completed file sync"
        : "No completed re-sync",
      icon: Clock3,
      action: props.onOpenDetails,
    },
  ];
  return (
    <section
      aria-label="Project summary"
      className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border shadow-xs sm:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map(({ label, value, detail, icon: Icon, action }) => (
        <button
          key={label}
          onClick={action}
          disabled={props.isLoading}
          className="group bg-card hover:bg-muted/40 focus-visible:ring-ring min-w-0 p-5 text-left transition-colors duration-200 last:col-span-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset xl:last:col-span-1"
        >
          <div className="text-muted-foreground mb-4 flex items-center justify-between gap-2 text-xs font-medium">
            <span>{label}</span>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
          </div>
          {props.isLoading ? (
            <>
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="truncate text-xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              <p className="text-muted-foreground mt-1.5 text-xs">{detail}</p>
            </>
          )}
        </button>
      ))}
    </section>
  );
}
export default memo(WorkspaceSummary);
